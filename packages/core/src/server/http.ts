import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { PostMcpServer, PostMcpServerOptions } from './runtime.js';
import * as http from 'node:http';

export interface HttpServerOptions extends PostMcpServerOptions {
  port?: number;
  host?: string;
  endpointPath?: string;
}

export async function startHttpServer(
  options: HttpServerOptions
): Promise<{ server: PostMcpServer; httpServer: http.Server; url: string }> {
  const postMcpServer = new PostMcpServer(options);
  const port = options.port !== undefined ? options.port : 3000;
  const host = options.host || 'localhost';
  const endpointPath = options.endpointPath || '/mcp';

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await postMcpServer.getServerInstance().connect(transport);

  const httpServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const currentPort = (httpServer.address() as any)?.port || port;
    const url = new URL(req.url || '', `http://${host}:${currentPort}`);

    if (url.pathname === endpointPath) {
      await transport.handleRequest(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  httpServer.on('close', () => {
    transport.close().catch(() => {});
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      resolve();
    });
  });

  const actualPort = (httpServer.address() as any)?.port || port;

  return {
    server: postMcpServer,
    httpServer,
    url: `http://${host}:${actualPort}${endpointPath}`,
  };
}
