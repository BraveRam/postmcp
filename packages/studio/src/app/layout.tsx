import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { ThemeProvider } from "@/components/theme-provider"

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
    <html lang="en" suppressHydrationWarning className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-white selection:text-black">
	<ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          {children}
	</ThemeProvider>
      </body>
    </html>
  );
}
