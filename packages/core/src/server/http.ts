import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { PostMcpServer, PostMcpServerOptions } from './runtime.js';
import * as http from 'node:http';

export interface HttpServerOptions extends PostMcpServerOptions {
  port?: number;
  host?: string;
  endpointPath?: string;
}

export async function startHttpServer(options: HttpServerOptions): Promise<{ server: PostMcpServer; httpServer: http.Server; url: string }> {
  const postMcpServer = new PostMcpServer(options);
  const port = options.port || 3000;
  const host = options.host || 'localhost';
  const endpointPath = options.endpointPath || '/mcp';

  let transport: SSEServerTransport | null = null;

  const httpServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '', `http://${host}:${port}`);

    if (url.pathname === endpointPath) {
      if (req.method === 'GET') {
        transport = new SSEServerTransport(endpointPath, res);
        await postMcpServer.getServerInstance().connect(transport);
      } else if (req.method === 'POST') {
        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'SSE connection must be established before sending POST messages' }));
        }
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      resolve();
    });
  });

  return {
    server: postMcpServer,
    httpServer,
    url: `http://${host}:${port}${endpointPath}`,
  };
}
