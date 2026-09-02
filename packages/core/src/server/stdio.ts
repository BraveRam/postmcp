import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PostMcpServer, PostMcpServerOptions } from './runtime.js';

export async function startStdioServer(options: PostMcpServerOptions): Promise<PostMcpServer> {
  const server = new PostMcpServer(options);
  const transport = new StdioServerTransport();
  await server.getServerInstance().connect(transport);
  return server;
}
