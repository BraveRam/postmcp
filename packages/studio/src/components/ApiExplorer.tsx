'use client';

import React, { useState } from 'react';
import { NormalizedOperation } from '@postmcp/types';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select';
import {
  Search,
  CheckSquare,
  Square,
  Layers,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';

interface ApiExplorerProps {
  operations: NormalizedOperation[];
  selectedOperationId: string | null;
  onSelectOperation: (op: NormalizedOperation) => void;
  enabledOperations: Record<string, boolean>;
  onToggleOperation: (id: string, enabled: boolean) => void;
  onToggleAll: (enabled: boolean) => void;
  onCloseMobile?: () => void;
}

export function ApiExplorer({
  operations,
  selectedOperationId,
  onSelectOperation,
  enabledOperations,
  onToggleOperation,
  onToggleAll,
  onCloseMobile,
}: ApiExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  const filteredOps = operations.filter((op) => {
    const matchesSearch =
      op.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (op.summary && op.summary.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMethod =
      methodFilter === 'all' || op.method.toLowerCase() === methodFilter.toLowerCase();

    return matchesSearch && matchesMethod;
  });

  const enabledCount = operations.filter((op) => enabledOperations[op.id] !== false).length;
  const allEnabled = enabledCount === operations.length;

  return (
    <div className="flex flex-col h-full bg-black border-r border-zinc-800 select-none">
      {/* Search & Header */}
      <div className="p-3 border-b border-zinc-800 space-y-2.5">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter operations..."
            className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-zinc-500"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 h-6 w-6 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Method & Quick Filters */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 gap-2">
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
              <span className="font-sans text-zinc-300">
                {enabledCount}/{operations.length} Active
              </span>
            </button>
          </div>

          <div className="w-28 shrink-0">
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="h-7 text-[11px] bg-zinc-900 border-zinc-800 text-zinc-200">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="get">GET</SelectItem>
                <SelectItem value="post">POST</SelectItem>
                <SelectItem value="put">PUT</SelectItem>
                <SelectItem value="patch">PATCH</SelectItem>
                <SelectItem value="delete">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Operations List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredOps.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-600 font-sans">No matching operations</div>
        ) : (
          filteredOps.map((op) => {
            const isSelected = op.id === selectedOperationId;
            const isEnabled = enabledOperations[op.id] !== false;

            return (
              <div
                key={op.id}
                onClick={() => {
                  onSelectOperation(op);
                  if (onCloseMobile) onCloseMobile();
                }}
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
                  className="mt-0.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                >
                  {isEnabled ? (
                    <CheckSquare className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-zinc-700" />
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        op.method === 'get'
                          ? 'default'
                          : op.method === 'post'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-[9px] uppercase px-1 py-0 font-bold tracking-wider"
                    >
                      {op.method}
                    </Badge>
                    <span className="font-sans text-xs font-medium text-zinc-200 truncate">
                      {op.id}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-500 truncate font-sans">
                    {op.path}
                  </p>
                </div>

                {/* Risk Indicator */}
                {op.riskTier && (
                  <span
                    className="text-[9px] font-sans px-1 py-0 rounded border border-zinc-800 text-zinc-400 bg-zinc-950 mt-0.5 shrink-0"
                  >
                    {op.riskTier}
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
