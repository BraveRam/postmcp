import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Zap } from 'lucide-react';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2 font-bold text-foreground tracking-tight text-sm">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Zap className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" />
          </div>
          <span className="text-foreground font-sans font-semibold">PostMCP</span>
          <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
            Docs
          </span>
        </div>
      ),
    },
    links: [
      {
        text: 'Visual Studio',
        url: '/',
      },
    ],
  };
}
