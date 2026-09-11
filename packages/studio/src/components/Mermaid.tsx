'use client';

import React, { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

export interface MermaidProps {
  chart: string;
  className?: string;
}

export function Mermaid({ chart, className }: MermaidProps) {
  const rawId = useId();
  const id = 'mermaid_' + rawId.replace(/[^a-zA-Z0-9]/g, '_');
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function renderChart() {
      try {
        setLoading(true);
        setError(null);

        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        const isDark = resolvedTheme === 'dark';

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          theme: isDark ? 'dark' : 'neutral',
          themeVariables: isDark
            ? {
                darkMode: true,
                background: '#09090b',
                primaryColor: '#27272a',
                primaryTextColor: '#f4f4f5',
                primaryBorderColor: '#3f3f46',
                lineColor: '#71717a',
                secondaryColor: '#18181b',
                tertiaryColor: '#18181b',
                textColor: '#e4e4e7',
                mainBkg: '#18181b',
                nodeBorder: '#3f3f46',
                fontSize: '16px',
              }
            : {
                darkMode: false,
                background: '#ffffff',
                primaryColor: '#f4f4f5',
                primaryTextColor: '#09090b',
                primaryBorderColor: '#e4e4e7',
                lineColor: '#71717a',
                secondaryColor: '#fafafa',
                tertiaryColor: '#fafafa',
                textColor: '#18181b',
                mainBkg: '#f4f4f5',
                nodeBorder: '#d4d4d8',
                fontSize: '16px',
              },
          themeCSS: `
            .node rect, .node circle, .node ellipse, .node polygon, .node path {
              stroke-width: 1.5px;
            }
            .edgePath path {
              stroke-width: 1.5px;
            }
            text, .label, .nodeLabel, .label text, .label div, .node div {
              font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
              font-size: 16px !important;
              font-weight: 500 !important;
            }
            .cluster-label text, .cluster-label span {
              font-size: 14px !important;
              font-weight: 600 !important;
            }
          `,
        });

        const cleanChart = chart.replaceAll('\\n', '\n').trim();
        const renderResult = await mermaid.render(id, cleanChart);

        if (!isCancelled) {
          let processedSvg = renderResult.svg;
          // Ensure SVG scales responsively without arbitrary pixel clamping
          processedSvg = processedSvg.replace(/style="max-width:\s*[\d.]+px;?"/gi, 'style="max-width: 100%; height: auto;"');
          setSvg(processedSvg);
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Mermaid render error:', err);
          setError(err?.message || 'Failed to render Mermaid diagram');
          setLoading(false);
        }
      }
    }

    renderChart();

    return () => {
      isCancelled = true;
    };
  }, [chart, resolvedTheme, id]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 font-sans">
        <p className="font-semibold mb-1">Diagram render error</p>
        <pre className="overflow-x-auto whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  if (loading && !svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-lg border border-fd-border bg-fd-card/50 p-8 text-xs text-fd-muted-foreground animate-pulse font-sans">
        Loading diagram...
      </div>
    );
  }

  return (
    <div className={`my-6 w-full overflow-x-auto rounded-xl border border-fd-border bg-fd-card/40 p-5 flex justify-center ${className || ''}`}>
      <div
        className="mermaid-svg-container w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
