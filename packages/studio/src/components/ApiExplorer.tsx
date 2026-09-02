import React, { useState } from 'react';
import { NormalizedOperation, HttpMethod, RiskTier } from '@postmcp/types';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Search, CheckSquare, Square, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface ApiExplorerProps {
  operations: NormalizedOperation[];
  selectedOperationId: string | null;
  onSelectOperation: (op: NormalizedOperation) => void;
  enabledOperations: Record<string, boolean>;
  onToggleOperation: (id: string, enabled: boolean) => void;
  onToggleAll: (enable: boolean) => void;
}

export function ApiExplorer({
  operations,
  selectedOperationId,
  onSelectOperation,
  enabledOperations,
  onToggleOperation,
  onToggleAll,
}: ApiExplorerProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const filteredOps = operations.filter((op) => {
    const matchesQuery =
      !filterQuery ||
      op.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      op.path.toLowerCase().includes(filterQuery.toLowerCase()) ||
      op.summary.toLowerCase().includes(filterQuery.toLowerCase()) ||
      op.tags.some((t) => t.toLowerCase().includes(filterQuery.toLowerCase()));

    const matchesMethod = methodFilter === 'all' || op.method.toLowerCase() === methodFilter.toLowerCase();
    const matchesRisk = riskFilter === 'all' || op.riskTier === riskFilter;

    return matchesQuery && matchesMethod && matchesRisk;
  });

  const allEnabled = operations.length > 0 && operations.every((op) => enabledOperations[op.id] !== false);
  const enabledCount = operations.filter((op) => enabledOperations[op.id] !== false).length;

  return (
    <div className="w-80 border-r border-slate-800/80 bg-[#090d16] flex flex-col h-full overflow-hidden shrink-0">
      {/* Search & Filters */}
      <div className="p-3 border-b border-slate-800/80 space-y-2 bg-[#0b101b]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <Input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter endpoints..."
            className="pl-8 h-8 text-xs bg-[#0d131f]"
          />
        </div>

        {/* Method & Risk Quick Filters */}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleAll(!allEnabled)}
              className="text-xs hover:text-blue-400 flex items-center gap-1 font-medium transition-colors"
            >
              {allEnabled ? (
                <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
              ) : (
                <Square className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>
                {enabledCount}/{operations.length} Enabled
              </span>
            </button>
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-[#0d131f] border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 focus:outline-none"
          >
            <option value="all">All Methods</option>
            <option value="get">GET</option>
            <option value="post">POST</option>
            <option value="put">PUT</option>
            <option value="patch">PATCH</option>
            <option value="delete">DELETE</option>
          </select>
        </div>
      </div>

      {/* Operations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1">
        {filteredOps.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No matching operations</div>
        ) : (
          filteredOps.map((op) => {
            const isSelected = op.id === selectedOperationId;
            const isEnabled = enabledOperations[op.id] !== false;

            return (
              <div
                key={op.id}
                onClick={() => onSelectOperation(op)}
                className={`group flex items-start gap-2 p-2.5 rounded-md cursor-pointer transition-colors text-xs select-none ${
                  isSelected
                    ? 'bg-blue-600/15 border border-blue-500/30'
                    : 'hover:bg-slate-800/40 border border-transparent'
                } ${!isEnabled ? 'opacity-40' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleOperation(op.id, e.target.checked);
                  }}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant={op.method.toLowerCase() as any} className="text-[9px] px-1 py-0 uppercase">
                      {op.method}
                    </Badge>
                    <span className="font-mono text-[11px] font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                      {op.path}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-slate-400 truncate">
                      {op.summary || op.id}
                    </span>

                    {op.riskTier === 'READ_ONLY' && (
                      <span title="Read-Only Safe" className="text-emerald-400">
                        <ShieldCheck className="h-3 w-3" />
                      </span>
                    )}
                    {op.riskTier === 'MUTATION' && (
                      <span title="State Mutation" className="text-blue-400">
                        <ShieldAlert className="h-3 w-3" />
                      </span>
                    )}
                    {op.riskTier === 'CRITICAL' && (
                      <span title="Critical / Destructive Risk" className="text-rose-400">
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
