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

export class PostMcpServer {
  private spec: NormalizedSpec;
  private registry: ToolRegistry;
  private httpClient: ResilientHttpClient;
  private server: Server;
  private tokenDietOptions: TokenDietOptions;
  private isDryRun: boolean;

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

    const { path, queryParams, headerParams, cookieParams } = serialized;

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
    const response = await this.httpClient.request({
      method: op.method as any,
      url: path,
      params: queryParams,
      headers: headerParams,
      data: bodyData,
      securityRequirement: op.security,
      specSecuritySchemes: this.spec.securitySchemes,
    });

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

    // 6. Apply Token Diet Compression
    const diet = applyTokenDiet(response.data, this.tokenDietOptions);

    return {
      content: [{ type: 'text', text: diet.text }],
    };
  }
}
