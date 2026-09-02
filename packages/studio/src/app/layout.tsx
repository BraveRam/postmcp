import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'PostMCP Visual Web Studio',
  description: 'Context-optimized OpenAPI to MCP Workbench with Token Diet Curator & Live Sandbox',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${GeistMono.variable}`}>
      <body className="min-h-screen bg-black text-zinc-100 font-mono antialiased selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}
