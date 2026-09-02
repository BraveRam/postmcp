import React, { useState } from 'react';
import { MacroDefinition, NormalizedOperation } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Sparkles, Plus, Trash2, ArrowRight, Play, CheckCircle2 } from 'lucide-react';

interface MacroBuilderProps {
  macros: MacroDefinition[];
  operations: NormalizedOperation[];
  onAddMacro: (macro: MacroDefinition) => void;
  onDeleteMacro: (macroName: string) => void;
}

export function MacroBuilder({
  macros,
  operations,
  onAddMacro,
  onDeleteMacro,
}: MacroBuilderProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<Array<{ id: string; action: string; exportKey?: string; exportPath?: string }>>([
    { id: 'step_1', action: 'GET /v1/customers?email={{email}}', exportKey: 'customerId', exportPath: 'data[0].id' },
    { id: 'step_2', action: 'POST /v1/refunds', exportKey: '', exportPath: '' },
  ]);

  const handleSave = () => {
    if (!name.trim()) return;

    const formattedSteps = steps.map((s) => ({
      id: s.id,
      action: s.action,
      export: s.exportKey && s.exportPath ? { [s.exportKey]: s.exportPath } : undefined,
    }));

    onAddMacro({
      name: name.trim(),
      description: description.trim() || `Composite macro workflow for ${name}`,
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Customer email address' },
          amount: { type: 'number', description: 'Amount to process' },
        },
        required: ['email'],
      },
      steps: formattedSteps,
    });

    setIsCreating(false);
    setName('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-blue-400" />
            Composite Multi-Step Macros
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Chain multiple discrete API calls into a single, context-efficient MCP tool for LLMs.
          </p>
        </div>

        {!isCreating && (
          <Button size="sm" onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-500">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Macro
          </Button>
        )}
      </div>

      {/* Creating Form */}
      {isCreating && (
        <div className="p-4 bg-[#0d131f] border border-blue-500/30 rounded-xl space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300">Macro Tool Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. createIssueAndComment"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this composite workflow accomplishes..."
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Sequential Execution Steps</label>
            {steps.map((step, idx) => (
              <div key={idx} className="p-3 bg-[#070a10] border border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-blue-400 font-semibold">
                    Step {idx + 1}: {step.id}
                  </span>
                  {steps.length > 1 && (
                    <button
                      onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Input
                  value={step.action}
                  onChange={(e) => {
                    const next = [...steps];
                    next[idx].action = e.target.value;
                    setSteps(next);
                  }}
                  placeholder="e.g. GET /v1/customers?email={{email}} or POST /v1/refunds"
                  className="font-mono text-xs"
                />

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Input
                    value={step.exportKey || ''}
                    onChange={(e) => {
                      const next = [...steps];
                      next[idx].exportKey = e.target.value;
                      setSteps(next);
                    }}
                    placeholder="Export Variable Name (e.g. customerId)"
                  />
                  <Input
                    value={step.exportPath || ''}
                    onChange={(e) => {
                      const next = [...steps];
                      next[idx].exportPath = e.target.value;
                      setSteps(next);
                    }}
                    placeholder="JSONPath extraction (e.g. data[0].id)"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setSteps([
                  ...steps,
                  {
                    id: `step_${steps.length + 1}`,
                    action: 'GET /v1/resource/{{customerId}}',
                  },
                ])
              }
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Sequential Step
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
              Save Macro Tool
            </Button>
          </div>
        </div>
      )}

      {/* Existing Macros List */}
      {macros.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-[#0d131f]/40 border border-slate-800/60 rounded-xl">
          No macros defined. Presets like <code className="text-blue-400">@github</code> or <code className="text-blue-400">@stripe</code> include built-in macros, or create your own above!
        </div>
      ) : (
        <div className="space-y-3">
          {macros.map((macro) => (
            <div
              key={macro.name}
              className="p-4 bg-[#0d131f]/80 border border-slate-800 hover:border-slate-700 rounded-xl space-y-3 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-mono font-semibold text-white text-sm">{macro.name}</h4>
                    <Badge variant="default" className="text-[10px]">
                      {macro.steps.length} steps
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{macro.description}</p>
                </div>

                <button
                  onClick={() => onDeleteMacro(macro.name)}
                  className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                  title="Delete macro"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Execution Steps Visualizer */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/60 font-mono text-xs">
                {macro.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2 text-slate-300 bg-[#070a10] p-2 rounded border border-slate-800/60">
                    <span className="text-slate-500 font-semibold">{idx + 1}.</span>
                    <span className="text-blue-400 font-medium">{step.action}</span>
                    {step.export && (
                      <span className="text-emerald-400 text-[10px] ml-auto">
                        → exports {JSON.stringify(step.export)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
