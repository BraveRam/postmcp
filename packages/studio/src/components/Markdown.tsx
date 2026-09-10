'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

import { CodeBlock } from './CodeBlock';

export interface MarkdownProps {
  children: string;
  className?: string;
}

export const Markdown = React.memo(function Markdown({ children, className }: MarkdownProps) {
  if (!children) return null;

  return (
    <div className={cn('markdown-body font-sans text-xs leading-relaxed break-words space-y-2', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: pChildren, ...props }) => (
            <p className="font-sans leading-relaxed text-xs mb-2 last:mb-0" {...props}>
              {pChildren}
            </p>
          ),
          h1: ({ children: hChildren, ...props }) => (
            <h1 className="text-base font-bold font-sans tracking-tight text-foreground mt-3 mb-2 border-b border-border pb-1" {...props}>
              {hChildren}
            </h1>
          ),
          h2: ({ children: hChildren, ...props }) => (
            <h2 className="text-sm font-bold font-sans tracking-tight text-foreground mt-3 mb-1.5" {...props}>
              {hChildren}
            </h2>
          ),
          h3: ({ children: hChildren, ...props }) => (
            <h3 className="text-xs font-semibold font-sans tracking-tight text-foreground mt-2 mb-1" {...props}>
              {hChildren}
            </h3>
          ),
          h4: ({ children: hChildren, ...props }) => (
            <h4 className="text-xs font-semibold font-sans tracking-tight text-foreground mt-1.5 mb-1" {...props}>
              {hChildren}
            </h4>
          ),
          ul: ({ children: ulChildren, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-2 pl-2 text-xs font-sans" {...props}>
              {ulChildren}
            </ul>
          ),
          ol: ({ children: olChildren, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 pl-2 text-xs font-sans" {...props}>
              {olChildren}
            </ol>
          ),
          li: ({ children: liChildren, ...props }) => (
            <li className="text-xs font-sans leading-relaxed text-foreground" {...props}>
              {liChildren}
            </li>
          ),
          blockquote: ({ children: bqChildren, ...props }) => (
            <blockquote className="border-l-2 border-primary/60 pl-3 my-2 text-muted-foreground italic text-xs font-sans bg-muted/20 py-1 rounded-r" {...props}>
              {bqChildren}
            </blockquote>
          ),
          code: ({ className: codeClassName, children: codeChildren, ...props }) => {
            const isInline = !codeClassName && typeof codeChildren === 'string' && !codeChildren.includes('\n');
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted/80 text-[11px] font-mono border border-border/50 text-foreground font-medium"
                  {...props}
                >
                  {codeChildren}
                </code>
              );
            }
            const match = /language-(\w+)/.exec(codeClassName || '');
            const language = match ? match[1] : '';
            const codeString = String(codeChildren).replace(/\n$/, '');
            return <CodeBlock code={codeString} language={language} />;
          },
          pre: ({ children: preChildren }) => <>{preChildren}</>,
          table: ({ children: tableChildren, ...props }) => (
            <div className="my-2 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs font-sans border-collapse text-left" {...props}>
                {tableChildren}
              </table>
            </div>
          ),
          thead: ({ children: theadChildren, ...props }) => (
            <thead className="bg-muted/50 border-b border-border" {...props}>
              {theadChildren}
            </thead>
          ),
          th: ({ children: thChildren, ...props }) => (
            <th className="px-3 py-1.5 text-xs font-semibold text-foreground font-sans border-r border-border last:border-r-0" {...props}>
              {thChildren}
            </th>
          ),
          td: ({ children: tdChildren, ...props }) => (
            <td className="px-3 py-1.5 text-xs text-foreground font-sans border-t border-border/50 border-r border-border last:border-r-0" {...props}>
              {tdChildren}
            </td>
          ),
          a: ({ href, children: aChildren, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity font-sans font-medium"
              {...props}
            >
              {aChildren}
            </a>
          ),
          strong: ({ children: strongChildren, ...props }) => (
            <strong className="font-bold text-foreground font-sans" {...props}>
              {strongChildren}
            </strong>
          ),
          hr: ({ ...props }) => <hr className="my-3 border-border" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
