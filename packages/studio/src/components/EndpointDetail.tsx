import React from 'react';
import { NormalizedOperation } from '@postmcp/types';
import { Badge } from './ui/Badge';
import { Shield, Key, FileText, Database } from 'lucide-react';

interface EndpointDetailProps {
  operation: NormalizedOperation;
}

export function EndpointDetail({ operation }: EndpointDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={operation.method.toLowerCase() as any} className="text-xs px-2 py-0.5 uppercase">
            {operation.method}
          </Badge>
          <span className="font-mono text-base font-semibold text-white">{operation.path}</span>
        </div>

        <h3 className="text-sm font-semibold text-slate-200">{operation.summary || operation.id}</h3>
        {operation.description && (
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{operation.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">Tool Name:</span>
          <Badge variant="secondary" className="font-mono text-[11px]">
            {operation.id}
          </Badge>

          <span className="text-slate-500 font-mono text-[11px] ml-2">Risk Tier:</span>
          <Badge
            variant={
              operation.riskTier === 'READ_ONLY'
                ? 'success'
                : operation.riskTier === 'MUTATION'
                ? 'default'
                : 'destructive'
            }
            className="text-[11px]"
          >
            {operation.riskTier}
          </Badge>

          {operation.tags.length > 0 && (
            <>
              <span className="text-slate-500 font-mono text-[11px] ml-2">Tags:</span>
              {operation.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Parameters */}
      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5 text-blue-400" />
          Parameters ({operation.parameters.length})
        </h4>

        {operation.parameters.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-3 bg-slate-900/40 border border-slate-800/60 rounded-lg">
            No parameters required for this endpoint.
          </div>
        ) : (
          <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-[#0d131f]/60 divide-y divide-slate-800/60">
            {operation.parameters.map((param) => (
              <div key={`${param.in}-${param.name}`} className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-200">{param.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">
                      {param.in}
                    </Badge>
                    <span className="font-mono text-[11px] text-blue-400">
                      {param.schema.type || 'string'}
                    </span>
                  </div>
                  {param.required && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">
                      Required
                    </Badge>
                  )}
                </div>
                {param.description && (
                  <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">{param.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input / Request Body Schema */}
      {operation.inputSchema?.properties && Object.keys(operation.inputSchema.properties).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-indigo-400" />
            Tool Input Schema (MCP Contract)
          </h4>
          <pre className="p-3 bg-[#070a10] border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-48">
            {JSON.stringify(operation.inputSchema, null, 2)}
          </pre>
        </div>
      )}

      {/* Response Schema */}
      {operation.responseSchema && (
        <div>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            Response Schema (HTTP 200/201)
          </h4>
          <pre className="p-3 bg-[#070a10] border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-48">
            {JSON.stringify(operation.responseSchema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
