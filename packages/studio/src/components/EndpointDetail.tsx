import React from 'react';
import { NormalizedOperation } from '@postmcp/types';
import { Badge } from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Key, FileText, Code2, ShieldAlert } from 'lucide-react';

interface EndpointDetailProps {
  operation: NormalizedOperation;
}

export function EndpointDetail({ operation }: EndpointDetailProps) {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={operation.method.toLowerCase() as any} className="text-xs px-2 py-0.5 uppercase">
              {operation.method}
            </Badge>
            <span className="font-sans text-sm font-semibold text-white">{operation.path}</span>
          </div>
          <CardTitle className="text-lg">{operation.summary || operation.id}</CardTitle>
          {operation.description && (
            <CardDescription>{operation.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-zinc-800/80">
            <span className="text-zinc-500 font-sans text-[11px]">Tool ID:</span>
            <Badge variant="secondary" className="font-sans text-[11px]">
              {operation.id}
            </Badge>

            <span className="text-zinc-500 font-sans text-[11px] ml-3">Risk Tier:</span>
            <Badge
              variant={
                operation.riskTier === 'READ_ONLY'
                  ? 'success'
                  : operation.riskTier === 'MUTATION'
                  ? 'warning'
                  : 'destructive'
              }
              className="text-[11px]"
            >
              {operation.riskTier}
            </Badge>

            {operation.tags.length > 0 && (
              <>
                <span className="text-zinc-500 font-sans text-[11px] ml-3">Tags:</span>
                {operation.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parameters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4 text-zinc-400" />
            Parameters ({operation.parameters.length})
          </CardTitle>
          <CardDescription>
            URL path, query, header, and cookie parameters accepted by this endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operation.parameters.length === 0 ? (
            <div className="text-xs text-zinc-500 font-sans italic p-4 bg-zinc-950 rounded border border-zinc-800 text-center">
              No parameters required for this endpoint.
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-md overflow-hidden bg-black divide-y divide-zinc-800/80">
              {operation.parameters.map((param) => (
                <div key={`${param.in}-${param.name}`} className="p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-sans">
                      <span className="font-semibold text-white">{param.name}</span>
                      <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
                        {param.in}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {param.schema?.type || 'string'}
                      </span>
                    </div>
                    {param.required && (
                      <Badge variant="default" className="text-[9px] px-1.5 py-0">
                        Required
                      </Badge>
                    )}
                  </div>
                  {param.description && (
                    <p className="text-zinc-400 mt-1.5 text-[11px] leading-relaxed">{param.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input Schema / Body Card */}
      {operation.inputSchema && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Code2 className="h-4 w-4 text-zinc-400" />
              Input / Request Schema
            </CardTitle>
            <CardDescription>
              Synthesized JSON Schema passed to LLM tool callers and validated at runtime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-black border border-zinc-800 rounded-md font-sans text-xs text-zinc-300 overflow-x-auto max-h-72">
              {JSON.stringify(operation.inputSchema, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
