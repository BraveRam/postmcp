import React, { useState, useEffect } from 'react';
import { NormalizedOperation, TokenDietResult } from '@postmcp/types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Switch } from './ui/Switch';
import { Sparkles, TrendingDown, Eye, CheckSquare, Square, RefreshCw, Layers } from 'lucide-react';

interface TokenDietCuratorProps {
  operation: NormalizedOperation;
  fieldMasks: Record<string, string[]>;
  onUpdateFieldMask: (path: string, fields: string[]) => void;
}

export function TokenDietCurator({
  operation,
  fieldMasks,
  onUpdateFieldMask,
}: TokenDietCuratorProps) {
  const currentMask = fieldMasks[operation.path] || [];
  const [maxTokens, setMaxTokens] = useState<number>(2500);
  const [convertToMarkdownTable, setConvertToMarkdownTable] = useState<boolean>(true);
  const [simulationResult, setSimulationResult] = useState<TokenDietResult | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Extract available response fields from responseSchema
  const availableFields: string[] = [];
  if (operation.responseSchema) {
    if (operation.responseSchema.properties) {
      availableFields.push(...Object.keys(operation.responseSchema.properties));
    } else if (operation.responseSchema.items?.properties) {
      availableFields.push(...Object.keys(operation.responseSchema.items.properties));
    }
  }

  // Generate a mock realistic payload for live Token Diet comparison
  const generateMockPayload = () => {
    if (availableFields.length === 0) {
      return {
        id: 'mock_123456789',
        status: 'active',
        created_at: '2026-09-02T12:00:00Z',
        name: 'Sample Entity',
        metadata: { client: 'test', env: 'production', tracking_code: 'TRK-9900-ABC-XYZ' },
        description: 'Detailed description of the API resource returned by the endpoint.',
        extra_noise_boilerplate: null,
        redundant_links: { self: '/api/v1/resource/mock_123456789', parent: '/api/v1/resources' },
      };
    }

    const item: Record<string, any> = {};
    for (const f of availableFields) {
      item[f] =
        f === 'id' || f.endsWith('_id')
          ? `${f}_${Math.floor(Math.random() * 100000)}`
          : f.includes('amount')
          ? 4999
          : f.includes('status') || f.includes('state')
          ? 'completed'
          : f.includes('email')
          ? 'user@example.com'
          : f.includes('created') || f.includes('date')
          ? '2026-09-02T12:00:00Z'
          : `sample_${f}_value`;
    }
    // Return array of items to showcase table transformation
    return [item, { ...item, id: `${item.id}_2` }, { ...item, id: `${item.id}_3` }];
  };

  const calculateDiet = () => {
    setIsCalculating(true);
    const mockData = generateMockPayload();

    fetch('/api/token-diet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: mockData,
        options: {
          enabled: true,
          fieldMasks: currentMask.length > 0 ? currentMask : undefined,
          maxTokens,
          convertToMarkdownTable,
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.result) setSimulationResult(data.result);
      })
      .catch(console.error)
      .finally(() => setIsCalculating(false));
  };

  useEffect(() => {
    calculateDiet();
  }, [operation.path, currentMask.join(','), maxTokens, convertToMarkdownTable]);

  const toggleField = (field: string) => {
    if (currentMask.includes(field)) {
      onUpdateFieldMask(
        operation.path,
        currentMask.filter((f) => f !== field)
      );
    } else {
      onUpdateFieldMask(operation.path, [...currentMask, field]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      {simulationResult && (
        <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/20 rounded-xl">
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Raw REST JSON</span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-0.5">
              ~{simulationResult.rawEstimatedTokens} <span className="text-xs text-slate-500 font-normal">toks</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-blue-400 font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Token Diet Output
            </span>
            <div className="text-xl font-bold font-mono text-blue-400 mt-0.5">
              ~{simulationResult.dietEstimatedTokens} <span className="text-xs text-blue-400/60 font-normal">toks</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Token Savings
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              -{simulationResult.savingsPercentage}%
            </div>
          </div>
        </div>
      )}

      {/* Field Mask Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              Select Response Fields (Field Mask)
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Select key fields to preserve. All unselected noise is pruned from LLM context.
            </p>
          </div>

          {currentMask.length > 0 && (
            <button
              onClick={() => onUpdateFieldMask(operation.path, [])}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline font-mono"
            >
              Reset to all fields
            </button>
          )}
        </div>

        {availableFields.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-3 bg-slate-900/40 border border-slate-800/60 rounded-lg">
            No discrete properties declared in response schema. Global noise pruning and Markdown table conversion still apply.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-[#0d131f]/70 border border-slate-800/80 rounded-lg max-h-48 overflow-y-auto">
            {availableFields.map((field) => {
              const isChecked = currentMask.includes(field);
              return (
                <div
                  key={field}
                  onClick={() => toggleField(field)}
                  className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors text-xs font-mono select-none ${
                    isChecked ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  )}
                  <span className="truncate">{field}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls: Table Switch & Max Tokens */}
      <div className="grid grid-cols-2 gap-4 p-3 bg-[#0d131f]/50 border border-slate-800/60 rounded-lg text-xs">
        <Switch
          checked={convertToMarkdownTable}
          onChange={setConvertToMarkdownTable}
          label="Auto-convert JSON Arrays to Markdown Tables"
        />

        <div className="flex items-center justify-end gap-2 font-mono">
          <span className="text-slate-400">Max Tokens:</span>
          <select
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="bg-[#070a10] border border-slate-800 rounded px-2 py-1 text-slate-200"
          >
            <option value="1000">1,000 toks</option>
            <option value="2500">2,500 toks (Default)</option>
            <option value="5000">5,000 toks</option>
            <option value="10000">10,000 toks</option>
          </select>
        </div>
      </div>

      {/* Live Output Preview */}
      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-blue-400" />
          Live Token Diet Preview (LLM Context Format)
        </h4>

        <pre className="p-3 bg-[#070a10] border border-slate-800/80 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-56 whitespace-pre-wrap leading-relaxed">
          {simulationResult?.text || 'Computing preview...'}
        </pre>
      </div>
    </div>
  );
}
