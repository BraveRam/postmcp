import React, { useState } from 'react';
import { NormalizedOperation, HttpMethod, RiskTier } from '@postmcp/types';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Search, CheckSquare, Square, Shield } from 'lucide-react';

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
    <div className="w-80 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden shrink-0">
      {/* Search & Filters */}
      <div className="p-3 border-b border-zinc-800 space-y-2.5 bg-black">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search endpoints..."
            className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800"
          />
        </div>

        {/* Method & Quick Filters */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleAll(!allEnabled)}
              className="text-xs hover:text-white flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
            >
              {allEnabled ? (
                <CheckSquare className="h-3.5 w-3.5 text-white" />
              ) : (
                <Square className="h-3.5 w-3.5 text-zinc-600" />
              )}
              <span className="font-mono text-zinc-300">
                {enabledCount}/{operations.length} Active
              </span>
            </button>
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500 cursor-pointer font-mono"
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
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredOps.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-600 font-mono">No matching operations</div>
        ) : (
          filteredOps.map((op) => {
            const isSelected = op.id === selectedOperationId;
            const isEnabled = enabledOperations[op.id] !== false;

            return (
              <div
                key={op.id}
                onClick={() => onSelectOperation(op)}
                className={`group flex items-start gap-2.5 p-2 rounded-md transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 border border-zinc-700 text-white shadow-xs'
                    : 'border border-transparent hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                } ${!isEnabled ? 'opacity-40' : ''}`}
              >
                {/* Enable checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleOperation(op.id, !isEnabled);
                  }}
                  className="mt-0.5 text-zinc-600 hover:text-white transition-colors cursor-pointer"
                >
                  {isEnabled ? (
                    <CheckSquare className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-zinc-600" />
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant={op.method.toLowerCase() as any} className="text-[9px] px-1 py-0 font-bold uppercase">
                      {op.method}
                    </Badge>
                    <span className="font-mono text-xs font-medium text-zinc-200 truncate">
                      {op.id}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-500 truncate font-mono">
                    {op.path}
                  </p>
                </div>

                {/* Risk Tier indicator */}
                {op.riskTier !== 'READ_ONLY' && (
                  <span
                    className="text-[9px] font-mono px-1 py-0 rounded border border-zinc-800 text-zinc-400 bg-zinc-950 mt-0.5"
                    title={`Risk Tier: ${op.riskTier}`}
                  >
                    {op.riskTier === 'CRITICAL' ? 'CRIT' : 'MUT'}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
