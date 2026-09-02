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
import { getToolAnnotations } from '../safety/classifier.js';
import { simulateExecution } from '../safety/dryrun.js';
import { executeMacro } from '../macro/executor.js';
import { isImageContentType, formatImageContent } from '../media/image.js';
import { isCsvContentType, csvToMarkdownTable } from '../media/csv.js';
import { saveBinaryArtifact } from '../media/binary.js';
import { ResilientHttpClient, AuthConfig } from '../http/index.js';

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

      // Add active operations
      for (const op of this.registry.getActiveOperations()) {
        const annotations = getToolAnnotations(op);
        tools.push({
          name: op.id,
          description: op.description || op.summary,
          inputSchema: op.inputSchema as any,
          ...annotations,
        } as any);
      }

      // Add macros
      if (this.spec.macros) {
        for (const macro of this.spec.macros) {
          tools.push({
            name: `macro_${macro.name}`,
            description: `[COMPOSITE WORKFLOW] ${macro.description}`,
            inputSchema: macro.parameters as any,
          });
        }
      }

      return { tools };
    });

    // 2. Dynamic Tool Mounting Notification
    this.registry.onToolsChanged(() => {
      try {
        this.server.notification({
          method: 'notifications/tools/list_changed',
        });
      } catch {
        // Ignored if client transport closed
      }
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

      // Handle Macro tools
      if (name.startsWith('macro_')) {
        const macroName = name.replace(/^macro_/, '');
        const macro = this.spec.macros?.find((m) => m.name === macroName);
        if (!macro) {
          return {
            content: [{ type: 'text', text: `Error: Macro '${macroName}' not found.` }],
            isError: true,
          };
        }

        const macroResult = await executeMacro(macro, args, this.httpClient);
        const diet = applyTokenDiet(macroResult.finalData, this.tokenDietOptions);
        return {
          content: [{ type: 'text', text: diet.text }],
        };
      }

      // Handle standard OpenAPI operations
      const operation = this.registry.getOperation(name);
      if (!operation) {
        return {
          content: [{ type: 'text', text: `Error: Tool '${name}' not found in registry.` }],
          isError: true,
        };
      }

      return await this.executeOperation(operation, args);
    });
  }

  private async executeOperation(op: NormalizedOperation, args: Record<string, any>): Promise<any> {
    // 1. Separate path, query, header, and body arguments
    let path = op.path;
    const queryParams: Record<string, any> = {};
    const headerParams: Record<string, string> = {};
    let bodyData: any = undefined;

    for (const param of op.parameters) {
      const val = args[param.name];
      if (val !== undefined) {
        if (param.in === 'path') {
          path = path.replace(`{${param.name}}`, encodeURIComponent(String(val)));
        } else if (param.in === 'query') {
          queryParams[param.name] = val;
        } else if (param.in === 'header') {
          headerParams[param.name] = String(val);
        }
      }
    }

    if (args['requestBody'] !== undefined) {
      bodyData = args['requestBody'];
    } else {
      // Gather remaining args not in path/query/header as body if POST/PUT/PATCH
      if (['post', 'put', 'patch'].includes(op.method)) {
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
    }

    // 2. Check Dry-Run Simulation Mode
    if (this.isDryRun && op.riskTier !== 'READ_ONLY') {
      const sim = simulateExecution(op, path, headerParams, bodyData);
      return {
        content: [{ type: 'text', text: JSON.stringify(sim, null, 2) }],
      };
    }

    // 3. Dispatch real HTTP request
    const response = await this.httpClient.request({
      method: op.method as any,
      url: path,
      params: queryParams,
      headers: headerParams,
      data: bodyData,
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

    // 4. Handle Media Responses
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
      const filePath = await saveBinaryArtifact(response.data, op.id);
      return {
        content: [
          {
            type: 'text',
            text: `Binary file received (${response.data.length} bytes) and saved to local artifact:\n${filePath}`,
          },
        ],
      };
    }

    // 5. Apply Token Diet Compression
    const diet = applyTokenDiet(response.data, this.tokenDietOptions);

    return {
      content: [{ type: 'text', text: diet.text }],
    };
  }
}
