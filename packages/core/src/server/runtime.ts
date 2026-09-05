import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { NormalizedSpec, NormalizedOperation } from '../parser/types.js';
import { ToolRegistry } from '../jit/registry.js';
import {
  TOOL_SEARCH_NAME,
  TOOL_SEARCH_DESCRIPTION,
  TOOL_SEARCH_INPUT_SCHEMA,
} from '../jit/meta-tool.js';
import { applyTokenDiet, TokenDietOptions } from '../tokendiet/index.js';
import { getToolAnnotations, getMacroAnnotations } from '../safety/classifier.js';
import { simulateExecution } from '../safety/dryrun.js';
import { executeMacro } from '../macro/executor.js';
import { isImageContentType, formatImageContent } from '../media/image.js';
import { isCsvContentType, csvToMarkdownTable } from '../media/csv.js';
import { saveBinaryArtifact } from '../media/binary.js';
import { ResilientHttpClient, AuthConfig, serializeParameters, validateInputArguments } from '../http/index.js';

export interface PostMcpServerOptions {
  spec: NormalizedSpec;
  baseUrl?: string;
  auth?: AuthConfig;
  tokenDiet?: TokenDietOptions;
  jit?: boolean;
  dryRun?: boolean;
  serverName?: string;
  serverVersion?: string;
}

const TENANT_PARAM_NAMES = new Set([
  'orgid', 'organizationid', 'organization',
  'teamid', 'accountid', 'tenantid', 'workspaceid'
]);

function isTenantParam(name: string): boolean {
  const norm = name.toLowerCase().replace(/[-_]/g, '');
  return TENANT_PARAM_NAMES.has(norm);
}

function isDummyTenantValue(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    return [
      'org-unknown', 'unknown', 'default', 'null', 'undefined',
      'none', 'test', 'placeholder', 'dummy', '0', ''
    ].includes(trimmed);
  }
  return false;
}

export class PostMcpServer {
  private spec: NormalizedSpec;
  private registry: ToolRegistry;
  private httpClient: ResilientHttpClient;
  private server: Server;
  private tokenDietOptions: TokenDietOptions;
  private isDryRun: boolean;
  private cachedTenantId: string | null = null;
  private cachedTenantIds: string[] = [];

  constructor(options: PostMcpServerOptions) {
    this.spec = options.spec;
    this.registry = new ToolRegistry(this.spec.operations, options.jit);
    this.tokenDietOptions = options.tokenDiet || { enabled: true, convertToMarkdownTable: true };
    this.isDryRun = Boolean(options.dryRun);

    const resolvedBaseUrl =
      options.baseUrl ||
      (this.spec.servers.length > 0 ? this.spec.servers[0].url : 'http://localhost');

    this.httpClient = new ResilientHttpClient({
      baseUrl: resolvedBaseUrl,
      auth: options.auth,
      specSecuritySchemes: this.spec.securitySchemes,
    });

    this.server = new Server(
      {
        name: options.serverName || this.spec.title || 'postmcp-server',
        version: options.serverVersion || this.spec.version || '1.0.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
      }
    );

    this.setupHandlers();
  }

  public getServerInstance(): Server {
    return this.server;
  }

  public getRegistry(): ToolRegistry {
    return this.registry;
  }

  private setupHandlers(): void {
    // 1. List Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [];

      // If in JIT mode, register the meta-tool `tool_search`
      if (this.registry.getIsJIT()) {
        tools.push({
          name: TOOL_SEARCH_NAME,
          description: TOOL_SEARCH_DESCRIPTION,
          inputSchema: TOOL_SEARCH_INPUT_SCHEMA as any,
        });
      }

      // Add active operations with proper MCP annotations nesting (Finding 4)
      for (const op of this.registry.getActiveOperations()) {
        const annotations = getToolAnnotations(op);
        tools.push({
          name: op.id,
          description: op.description || op.summary,
          inputSchema: op.inputSchema as any,
          annotations: annotations as any,
        });
      }

      // Add macros
      if (this.spec.macros) {
        for (const macro of this.spec.macros) {
          const annotations = getMacroAnnotations(macro);
          tools.push({
            name: `macro_${macro.name}`,
            description: `[COMPOSITE WORKFLOW] ${macro.description}`,
            inputSchema: macro.parameters as any,
            annotations: annotations as any,
          });
        }
      }

      return { tools };
    });

    // 2. Dynamic Tool Mounting Notification
    this.registry.onToolsChanged(() => {
      this.server
        .notification({
          method: 'notifications/tools/list_changed',
        })
        .catch(() => {
          // Safely ignored if server is offline or in testing mode
        });
    });

    // 3. Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      // Handle JIT tool_search meta-tool
      if (name === TOOL_SEARCH_NAME) {
        const query = String(args.query || '');
        const tag = args.tag ? String(args.tag) : undefined;
        const limit = typeof args.limit === 'number' ? args.limit : 5;

        const mounted = this.registry.mountToolsByQuery(query, tag, limit);
        const mountedSummary = mounted.map((op) => ({
          name: op.id,
          method: op.method.toUpperCase(),
          path: op.path,
          summary: op.summary,
        }));

        return {
          content: [
            {
              type: 'text',
              text: `Mounted ${mounted.length} relevant tools into active context:\n\n${JSON.stringify(
                mountedSummary,
                null,
                2
              )}\n\nYou can now call any of the above tools directly in your next action.`,
            },
          ],
        };
      }

      // Handle Macro tools (with dry-run protection, Finding 2)
      if (name.startsWith('macro_')) {
        const macroName = name.replace(/^macro_/, '');
        const macro = this.spec.macros?.find((m) => m.name === macroName);
        if (!macro) {
          return {
            content: [{ type: 'text', text: `Error: Macro '${macroName}' not found.` }],
            isError: true,
          };
        }

        const macroResult = await executeMacro(macro, args, this.httpClient, this.isDryRun);
        if (!macroResult.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Macro Execution Failed: ${macroResult.errorMessage || 'Unknown step failure'}`,
              },
            ],
            isError: true,
          };
        }

        const diet = applyTokenDiet(macroResult.finalData, this.tokenDietOptions);
        return {
          content: [{ type: 'text', text: diet.text }],
        };
      }

      // Handle standard OpenAPI operations (Finding 1: checks activeOperations in JIT mode)
      const operation = this.registry.getOperation(name);
      if (!operation) {
        const isHiddenInJIT = this.registry.getIsJIT() && this.registry.getAllOperations().some((op) => op.id === name);
        const hint = isHiddenInJIT
          ? `Tool '${name}' is not currently mounted. Please call 'tool_search' with relevant keywords first to mount it.`
          : `Tool '${name}' not found in registry.`;

        return {
          content: [{ type: 'text', text: `Error: ${hint}` }],
          isError: true,
        };
      }

      return await this.executeOperation(operation, args);
    });
  }

  private async executeOperation(op: NormalizedOperation, args: Record<string, any>): Promise<any> {
    // 0. Auto-Inject Tenant Context (e.g. org_id, team_id) if missing or dummy
    await this.autoInjectTenantContext(op, args);

    // 1. Validate required inputs (Finding 11)
    const validation = validateInputArguments(op.inputSchema, args);
    if (!validation.valid) {
      return {
        content: [
          {
            type: 'text',
            text: `Validation Error for tool '${op.id}':\n- ${validation.errors.join('\n- ')}`,
          },
        ],
        isError: true,
      };
    }

    // 2. Serialize parameters according to OpenAPI styles (Finding 9 & 10)
    let serialized: ReturnType<typeof serializeParameters>;
    try {
      serialized = serializeParameters(op.path, op.parameters, args);
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Parameter Error: ${err.message}` }],
        isError: true,
      };
    }

    let { path, queryParams, headerParams, cookieParams } = serialized;

    // Attach Cookie header if cookie parameters are present (Finding 10)
    if (Object.keys(cookieParams).length > 0) {
      const cookieStr = Object.entries(cookieParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('; ');
      headerParams['Cookie'] = cookieStr;
    }

    // Set Content-Type from spec if declared (Finding 10)
    if (op.contentType && ['post', 'put', 'patch', 'delete'].includes(op.method)) {
      headerParams['Content-Type'] = op.contentType;
    }

    // Build Request Body (support POST, PUT, PATCH, and DELETE with bodies)
    let bodyData: any = undefined;
    if (args['requestBody'] !== undefined) {
      bodyData = args['requestBody'];
    } else if (['post', 'put', 'patch', 'delete'].includes(op.method)) {
      const bodyObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(args)) {
        if (!op.parameters.some((p) => p.name === k)) {
          bodyObj[k] = v;
        }
      }
      if (Object.keys(bodyObj).length > 0) {
        bodyData = bodyObj;
      }
    }

    // If URL-encoded content type, serialize body (Finding 10)
    if (op.contentType === 'application/x-www-form-urlencoded' && bodyData && typeof bodyData === 'object') {
      const formParams = new URLSearchParams();
      for (const [k, v] of Object.entries(bodyData)) {
        formParams.append(k, String(v));
      }
      bodyData = formParams.toString();
    } else if (
      (op.contentType === 'multipart/form-data' || headerParams['Content-Type']?.includes('multipart/form-data')) &&
      bodyData &&
      typeof bodyData === 'object' &&
      !(bodyData instanceof FormData)
    ) {
      const formData = new FormData();
      for (const [k, v] of Object.entries(bodyData)) {
        if (v instanceof Blob || typeof v === 'string') {
          formData.append(k, v);
        } else if (Buffer.isBuffer(v)) {
          formData.append(k, new Blob([new Uint8Array(v)]));
        } else if (typeof v === 'object' && v !== null) {
          formData.append(k, JSON.stringify(v));
        } else if (v !== undefined && v !== null) {
          formData.append(k, String(v));
        }
      }
      bodyData = formData;
      delete headerParams['Content-Type'];
    }

    const fullTargetUrl = `${this.httpClient.getBaseUrl()}/${path.replace(/^\//, '')}`;

    // 3. Check Dry-Run Simulation Mode (Finding 15)
    if (this.isDryRun && op.riskTier !== 'READ_ONLY') {
      const sim = simulateExecution(op, fullTargetUrl, headerParams, queryParams, bodyData);
      return {
        content: [{ type: 'text', text: JSON.stringify(sim, null, 2) }],
      };
    }

    // 4. Dispatch real HTTP request
    let response = await this.httpClient.request({
      method: op.method as any,
      url: path,
      params: queryParams,
      headers: headerParams,
      data: bodyData,
      securityRequirement: op.security,
      specSecuritySchemes: this.spec.securitySchemes,
    });

    // Multi-Tenant Fallback: If empty or tenant error and multiple organizations available
    const tenantParam = op.parameters.find((p) => isTenantParam(p.name));
    if (tenantParam && (response.isError || this.isResponseDataEmpty(response.data))) {
      if (this.cachedTenantIds.length <= 1) {
        await this.discoverTenantIds();
      }
      const currentAttempt = args[tenantParam.name];
      for (const altTenantId of this.cachedTenantIds) {
        if (altTenantId === currentAttempt) continue;
        const altArgs = { ...args, [tenantParam.name]: altTenantId };
        try {
          const altSerialized = serializeParameters(op.path, op.parameters, altArgs);
          const altRes = await this.httpClient.request({
            method: op.method as any,
            url: altSerialized.path,
            params: altSerialized.queryParams,
            headers: { ...headerParams, ...altSerialized.headerParams },
            data: bodyData,
            securityRequirement: op.security,
            specSecuritySchemes: this.spec.securitySchemes,
          });
          if (!altRes.isError && !this.isResponseDataEmpty(altRes.data)) {
            response = altRes;
            this.cachedTenantId = altTenantId;
            queryParams = altSerialized.queryParams;
            headerParams = { ...headerParams, ...altSerialized.headerParams };
            path = altSerialized.path;
            break;
          }
        } catch {
          // Ignore fallback serialization/request errors and try next
        }
      }
    }

    if (response.isError) {
      return {
        content: [
          {
            type: 'text',
            text: `API Request Failed: ${response.errorMessage || 'Unknown Error'}\n\nSuggested Fix: Verify parameter values and authentication permissions.`,
          },
        ],
        isError: true,
      };
    }

    // Auto-Pagination: Transparently follow pagination cursor for up to 3 pages internally
    if (response.data) {
      response.data = await this.autoPaginateResponse(op, path, queryParams, headerParams, response.data);
    }

    // 5. Handle Media Responses (Finding 12 & 21)
    const contentType = response.contentType || '';
    if (isImageContentType(contentType) && Buffer.isBuffer(response.data)) {
      const imageBlock = formatImageContent(response.data, contentType);
      return {
        content: [imageBlock, { type: 'text', text: `Image returned from ${op.id} (${contentType})` }],
      };
    }

    if (isCsvContentType(contentType) && typeof response.data === 'string') {
      const mdTable = csvToMarkdownTable(response.data);
      return {
        content: [{ type: 'text', text: mdTable }],
      };
    }

    if (Buffer.isBuffer(response.data)) {
      const filePath = await saveBinaryArtifact(response.data, op.id, contentType);
      return {
        content: [
          {
            type: 'text',
            text: `Binary file received (${response.data.length} bytes, type: ${contentType || 'binary'}) and saved to local artifact:\n${filePath}`,
          },
        ],
      };
    }

    // 6. Apply Operation-Aware Token Diet Compression (Finding 2)
    let activeFieldMasks: string[] | undefined = this.tokenDietOptions.fieldMasks;
    if (this.tokenDietOptions.pathFieldMasks) {
      if (this.tokenDietOptions.pathFieldMasks[op.path]) {
        activeFieldMasks = this.tokenDietOptions.pathFieldMasks[op.path];
      } else {
        for (const [maskPath, fields] of Object.entries(this.tokenDietOptions.pathFieldMasks)) {
          const regexStr = '^' + maskPath.replace(/\{[^}]+\}/g, '[^/]+') + '$';
          if (maskPath === op.path || new RegExp(regexStr).test(op.path)) {
            activeFieldMasks = fields;
            break;
          }
        }
      }
    }

    const diet = applyTokenDiet(response.data, {
      ...this.tokenDietOptions,
      fieldMasks: activeFieldMasks,
    });

    return {
      content: [{ type: 'text', text: diet.text }],
    };
  }

  private async autoInjectTenantContext(op: NormalizedOperation, args: Record<string, any>): Promise<string | null> {
    const tenantParam = op.parameters.find((p) => isTenantParam(p.name));
    if (!tenantParam) return null;

    const currentValue = args[tenantParam.name];
    if (!isDummyTenantValue(currentValue)) {
      return String(currentValue);
    }

    const tenantId = await this.resolveTenantId();
    if (tenantId) {
      args[tenantParam.name] = tenantId;
      return tenantId;
    }
    return null;
  }

  private async resolveTenantId(): Promise<string | null> {
    const envVal =
      process.env.NEON_ORG_ID ||
      process.env.ORG_ID ||
      process.env.ORGANIZATION_ID ||
      process.env.TEAM_ID ||
      process.env.ACCOUNT_ID ||
      process.env.TENANT_ID;

    if (envVal && !isDummyTenantValue(envVal)) {
      this.cachedTenantId = envVal.trim();
      if (!this.cachedTenantIds.includes(this.cachedTenantId)) {
        this.cachedTenantIds.unshift(this.cachedTenantId);
      }
      return this.cachedTenantId;
    }

    if (this.cachedTenantId) {
      return this.cachedTenantId;
    }

    const discovered = await this.discoverTenantIds();
    if (discovered.length > 0) {
      this.cachedTenantIds = discovered;
      this.cachedTenantId = discovered[0];
      return this.cachedTenantId;
    }

    return null;
  }

  private async discoverTenantIds(): Promise<string[]> {
    if (this.cachedTenantIds.length > 0) {
      return this.cachedTenantIds;
    }

    const candidates = this.spec.operations.filter((op) => {
      if (op.method !== 'get') return false;
      if (op.path.includes('{')) return false;
      const requiredParams = op.parameters.filter((p) => p.required);
      if (requiredParams.length > 0) return false;

      const pathLower = op.path.toLowerCase();
      const idLower = op.id.toLowerCase();
      return (
        pathLower.includes('organization') ||
        pathLower.includes('/org') ||
        pathLower.includes('/team') ||
        pathLower.includes('/account') ||
        pathLower.includes('/workspace') ||
        pathLower.includes('/users/me') ||
        pathLower.includes('/user/orgs') ||
        idLower.includes('organization') ||
        idLower.includes('getcurrentuser')
      );
    });

    if (candidates.length === 0) return [];

    candidates.sort((a, b) => {
      const score = (op: NormalizedOperation) => {
        const p = op.path.toLowerCase();
        if (p.includes('/users/me/organizations') || p.includes('/user/orgs')) return 100;
        if (p.includes('/organizations') || p.includes('/orgs')) return 80;
        if (p.includes('/teams')) return 70;
        if (p.includes('/accounts')) return 60;
        if (p.includes('/users/me') || p.includes('/user')) return 50;
        return 10;
      };
      return score(b) - score(a);
    });

    for (const candidate of candidates.slice(0, 2)) {
      try {
        const res = await this.httpClient.request({
          method: 'get',
          url: candidate.path,
          securityRequirement: candidate.security,
          specSecuritySchemes: this.spec.securitySchemes,
        });

        if (!res.isError && res.data) {
          const ids = this.extractTenantIdsFromData(res.data);
          if (ids.length > 0) {
            this.cachedTenantIds = ids;
            this.cachedTenantId = ids[0];
            return ids;
          }
        }
      } catch {
        // Silently continue to next candidate
      }
    }

    return [];
  }

  private extractTenantIdsFromData(data: any): string[] {
    const ids: string[] = [];
    const extractFromItem = (item: any) => {
      if (!item || typeof item !== 'object') return;
      const candidateId =
        item.id || item.org_id || item.organization_id || item.team_id || item.account_id || item.slug;
      if (typeof candidateId === 'string' && candidateId.trim().length > 0 && !isDummyTenantValue(candidateId)) {
        if (!ids.includes(candidateId.trim())) {
          ids.push(candidateId.trim());
        }
      }
    };

    if (Array.isArray(data)) {
      data.forEach(extractFromItem);
    } else if (data && typeof data === 'object') {
      const keys = ['organizations', 'orgs', 'teams', 'accounts', 'data', 'items', 'workspaces'];
      for (const k of keys) {
        if (Array.isArray(data[k])) {
          data[k].forEach(extractFromItem);
        }
      }
      if (ids.length === 0) {
        extractFromItem(data);
      }
    }

    return ids;
  }

  private isResponseDataEmpty(data: any): boolean {
    if (!data) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return true;
      let hasArray = false;
      let allArraysEmpty = true;
      for (const val of Object.values(data)) {
        if (Array.isArray(val)) {
          hasArray = true;
          if (val.length > 0) {
            allArraysEmpty = false;
            break;
          }
        }
      }
      if (hasArray && allArraysEmpty) return true;
    }
    return false;
  }

  private extractNextCursor(data: any): string | null {
    if (!data || typeof data !== 'object') return null;

    if (data.pagination && typeof data.pagination === 'object') {
      if (typeof data.pagination.cursor === 'string' && data.pagination.cursor) return data.pagination.cursor;
      if (typeof data.pagination.next_cursor === 'string' && data.pagination.next_cursor) return data.pagination.next_cursor;
    }

    if (typeof data.next_cursor === 'string' && data.next_cursor) return data.next_cursor;
    if (typeof data.cursor === 'string' && data.cursor) return data.cursor;

    if (data.has_more === true) {
      const list = Array.isArray(data.data) ? data.data : (Array.isArray(data.items) ? data.items : null);
      if (list && list.length > 0 && list[list.length - 1]?.id) {
        return String(list[list.length - 1].id);
      }
    }

    return null;
  }

  private async autoPaginateResponse(
    op: NormalizedOperation,
    path: string,
    queryParams: Record<string, any>,
    headerParams: Record<string, string>,
    initialData: any
  ): Promise<any> {
    if (op.method !== 'get' || !initialData || typeof initialData !== 'object') {
      return initialData;
    }

    let primaryArrayKey: string | null = null;
    let targetArray: any[] | null = null;

    if (Array.isArray(initialData)) {
      targetArray = initialData;
    } else {
      for (const [k, v] of Object.entries(initialData)) {
        if (Array.isArray(v)) {
          primaryArrayKey = k;
          targetArray = v;
          break;
        }
      }
    }

    if (!targetArray || targetArray.length === 0) {
      return initialData;
    }

    const cursorParam = op.parameters.find(
      (p) => p.in === 'query' && ['cursor', 'starting_after', 'start_cursor', 'next_cursor', 'page_token', 'pageToken'].includes(p.name)
    );
    const cursorParamName = cursorParam ? cursorParam.name : (op.parameters.some((p) => p.name === 'cursor') ? 'cursor' : null);
    if (!cursorParamName) {
      return initialData;
    }

    let currentCursor = this.extractNextCursor(initialData);
    let pagesFetched = 1;
    const maxPages = 3;

    while (currentCursor && pagesFetched < maxPages) {
      const nextQueryParams = { ...queryParams, [cursorParamName]: currentCursor };
      const nextRes = await this.httpClient.request({
        method: 'get',
        url: path,
        params: nextQueryParams,
        headers: headerParams,
        securityRequirement: op.security,
        specSecuritySchemes: this.spec.securitySchemes,
      });

      if (nextRes.isError || !nextRes.data) {
        break;
      }

      let newItems: any[] | null = null;
      if (primaryArrayKey && Array.isArray(nextRes.data[primaryArrayKey])) {
        newItems = nextRes.data[primaryArrayKey];
      } else if (Array.isArray(nextRes.data)) {
        newItems = nextRes.data;
      }

      if (!newItems || newItems.length === 0) {
        break;
      }

      targetArray.push(...newItems);
      pagesFetched++;

      const nextCursor = this.extractNextCursor(nextRes.data);
      if (nextCursor === currentCursor) {
        break;
      }
      currentCursor = nextCursor;
    }

    if (initialData.pagination && typeof initialData.pagination === 'object') {
      if ('cursor' in initialData.pagination) {
        initialData.pagination.cursor = currentCursor || undefined;
      }
      if ('next_cursor' in initialData.pagination) {
        initialData.pagination.next_cursor = currentCursor || undefined;
      }
    }
    if ('next_cursor' in initialData) {
      initialData.next_cursor = currentCursor || undefined;
    }

    return initialData;
  }
}
