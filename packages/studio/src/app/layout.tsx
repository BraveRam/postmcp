import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { ThemeProvider } from "@/components/theme-provider";
import { RootProvider } from 'fumadocs-ui/provider/next';

export const metadata: Metadata = {
  title: 'PostMCP Visual Web Studio',
  description: 'Context-optimized OpenAPI to MCP Workbench with Token Diet Curator & Live Sandbox',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased flex flex-col">
        <RootProvider
          theme={{
            enabled: false,
          }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </RootProvider>
      </body>
    </html>
  );
}
