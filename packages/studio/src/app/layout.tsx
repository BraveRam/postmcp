import type { Metadata } from 'next';
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
