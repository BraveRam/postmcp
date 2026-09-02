import React, { useState, useEffect } from 'react';
import { NormalizedOperation, TokenDietResult } from '@postmcp/types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Switch } from './ui/Switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
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

  const selectAllFields = () => {
    onUpdateFieldMask(operation.path, [...availableFields]);
  };

  const clearMask = () => {
    onUpdateFieldMask(operation.path, []);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="font-sans text-[11px] uppercase tracking-wider text-zinc-500">
              Raw Token Cost
            </CardDescription>
            <CardTitle className="text-2xl font-sans text-white">
              {simulationResult ? simulationResult.rawEstimatedTokens : '...'} tokens
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-zinc-500 font-sans">
            Unfiltered JSON response
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="font-sans text-[11px] uppercase tracking-wider text-zinc-500">
              Token Diet Output
            </CardDescription>
            <CardTitle className="text-2xl font-sans text-white">
              {simulationResult ? simulationResult.dietEstimatedTokens : '...'} tokens
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-zinc-500 font-sans">
            Masked & formatted for LLM
          </CardContent>
        </Card>

        <Card className="border-white/20 bg-zinc-950">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="font-sans text-[11px] uppercase tracking-wider text-zinc-400">
              Efficiency Gain
            </CardDescription>
            <CardTitle className="text-2xl font-sans text-white flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-white" />
              {simulationResult ? `${simulationResult.savingsPercentage}%` : '...'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-zinc-400 font-sans">
            Token footprint reduction
          </CardContent>
        </Card>
      </div>

      {/* Field Mask Selection */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-zinc-400" />
              Response Field Masking ({currentMask.length}/{availableFields.length || 'All'} selected)
            </CardTitle>
            <CardDescription>
              Select high-signal fields to include in LLM context. Unselected fields are stripped automatically.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {availableFields.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={selectAllFields}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearMask}>
                  Clear Mask
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableFields.length === 0 ? (
            <div className="text-xs text-zinc-500 font-sans p-4 bg-zinc-950 rounded border border-zinc-800 text-center">
              No schema properties defined in response schema. Using automatic Token Diet heuristic filtering.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {availableFields.map((field) => {
                const isSelected = currentMask.includes(field);
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => toggleField(field)}
                    className={`flex items-center gap-2 p-2 rounded border text-xs font-sans transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 border-white text-white font-semibold shadow-xs'
                        : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-white shrink-0" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                    )}
                    <span className="truncate">{field}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Table Optimization Toggle */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <div>
              <span className="text-xs font-semibold text-white block">
                Markdown Table Formatting
              </span>
              <span className="text-[11px] text-zinc-500">
                Transform array payloads into compact Markdown tables for ~60% extra token savings.
              </span>
            </div>
            <Switch
              checked={convertToMarkdownTable}
              onChange={setConvertToMarkdownTable}
            />
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-zinc-400" />
            Live Formatted Response Preview
          </CardTitle>
          <CardDescription>
            The exact text injected into the LLM context window when calling this tool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-black border border-zinc-800 rounded-md font-sans text-xs text-zinc-200 overflow-x-auto max-h-96 whitespace-pre">
            {simulationResult ? simulationResult.text : 'Calculating preview...'}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
