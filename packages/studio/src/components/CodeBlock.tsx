'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

const KEYWORDS = new Set([
  'public', 'private', 'protected', 'class', 'static', 'void', 'final', 'abstract',
  'extends', 'implements', 'interface', 'new', 'return', 'this', 'super',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue',
  'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'export', 'from',
  'const', 'let', 'var', 'function', 'async', 'await', 'yield', 'type', 'enum', 'namespace',
  'def', 'elif', 'except', 'lambda', 'pass', 'with', 'as', 'is', 'not', 'in',
  'select', 'where', 'insert', 'update', 'delete', 'create', 'table', 'join',
  'fn', 'pub', 'struct', 'impl', 'mut', 'match', 'use', 'mod', 'crate', 'val',
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
  'GROUP', 'ORDER', 'BY', 'LIMIT', 'HAVING', 'AND', 'OR', 'NOT', 'NULL', 'PRIMARY', 'KEY'
]);

const LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'nil', 'None', 'True', 'False', 'NaN', 'Infinity'
]);

const BUILTIN_TYPES = new Set([
  'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'Byte', 'Short',
  'System', 'Object', 'List', 'Map', 'Set', 'ArrayList', 'HashMap', 'HashSet', 'Arrays', 'Collections',
  'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short',
  'number', 'string', 'any', 'unknown', 'never', 'void',
  'Promise', 'Record', 'Array', 'Error', 'Console', 'console', 'Math', 'JSON', 'Date', 'RegExp'
]);

type TokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'literal'
  | 'keyword'
  | 'type'
  | 'function'
  | 'decorator'
  | 'property'
  | 'punct'
  | 'ident';

interface Token {
  type: TokenType;
  text: string;
}

function tokenize(code: string): Token[] {
  const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)(?=\s*\()|(@[a-zA-Z_$][a-zA-Z0-9_$]*\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)|([{}()[\];,.<>:=+\-*/&|!~%^?])/g;

  const rawTokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      rawTokens.push({ type: 'plain', text: code.slice(lastIndex, match.index) });
    }
    const [, comment, str, num, fn, deco, word, punct] = match;
    if (comment) {
      rawTokens.push({ type: 'comment', text: comment });
    } else if (str) {
      rawTokens.push({ type: 'string', text: str });
    } else if (num) {
      rawTokens.push({ type: 'number', text: num });
    } else if (deco) {
      rawTokens.push({ type: 'decorator', text: deco });
    } else if (fn) {
      if (KEYWORDS.has(fn)) {
        rawTokens.push({ type: 'keyword', text: fn });
      } else {
        rawTokens.push({ type: 'function', text: fn });
      }
    } else if (word) {
      if (KEYWORDS.has(word)) {
        rawTokens.push({ type: 'keyword', text: word });
      } else if (LITERALS.has(word)) {
        rawTokens.push({ type: 'literal', text: word });
      } else if (BUILTIN_TYPES.has(word) || /^[A-Z][a-zA-Z0-9_$]*$/.test(word)) {
        rawTokens.push({ type: 'type', text: word });
      } else {
        rawTokens.push({ type: 'ident', text: word });
      }
    } else if (punct) {
      rawTokens.push({ type: 'punct', text: punct });
    }
    lastIndex = tokenRegex.lastIndex;
  }
  if (lastIndex < code.length) {
    rawTokens.push({ type: 'plain', text: code.slice(lastIndex) });
  }

  // Second pass: distinguish JSON / object properties (string or ident immediately before :)
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    if (token.type === 'string' || token.type === 'ident') {
      let isProp = false;
      for (let j = i + 1; j < rawTokens.length; j++) {
        if (rawTokens[j].type === 'plain' && !rawTokens[j].text.includes('\n')) continue;
        if (rawTokens[j].type === 'punct' && rawTokens[j].text === ':') {
          isProp = true;
        }
        break;
      }
      if (isProp) {
        rawTokens[i] = { type: 'property', text: token.text };
      }
    }
  }

  return rawTokens;
}

function getTokenClass(type: TokenType): string {
  switch (type) {
    case 'keyword':
      return 'text-purple-400 dark:text-purple-400 font-semibold';
    case 'type':
      return 'text-amber-300 dark:text-amber-300 font-medium';
    case 'string':
      return 'text-emerald-400 dark:text-emerald-400';
    case 'property':
      return 'text-sky-300 dark:text-sky-300';
    case 'number':
    case 'literal':
      return 'text-orange-400 dark:text-orange-300';
    case 'function':
      return 'text-blue-400 dark:text-sky-400';
    case 'comment':
      return 'text-muted-foreground/60 italic';
    case 'decorator':
      return 'text-yellow-400 dark:text-yellow-300 font-medium';
    case 'punct':
      return 'text-muted-foreground';
    case 'ident':
      return 'text-foreground';
    default:
      return 'text-foreground';
  }
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const tokens = React.useMemo(() => tokenize(code), [code]);

  return (
    <div
      className={cn(
        'relative my-2.5 rounded-lg border border-border/80 bg-zinc-950/80 dark:bg-zinc-950/90 shadow-sm overflow-hidden text-xs font-mono text-zinc-100',
        className
      )}
    >
      {/* Header bar: language badge + copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-zinc-900/70 dark:bg-zinc-900/90 text-[11px] font-sans text-muted-foreground select-none">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground/80">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors px-2 py-0.5 rounded text-[10px] hover:bg-muted/40 font-sans cursor-pointer outline-none focus:outline-none"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Formatted & syntax-highlighted code */}
      <pre className="p-3.5 overflow-x-auto text-[11px] leading-relaxed font-mono">
        <code>
          {tokens.map((token, i) => (
            <span key={i} className={getTokenClass(token.type)}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
