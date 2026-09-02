import React, { useState } from 'react';
import { MacroDefinition, NormalizedOperation } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Sparkles, Plus, Trash2, ArrowRight, Play, Workflow } from 'lucide-react';

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

  const handleAddStep = () => {
    setSteps([
      ...steps,
      {
        id: `step_${steps.length + 1}`,
        action: 'GET /endpoint',
        exportKey: '',
        exportPath: '',
      },
    ]);
  };

  const handleRemoveStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const handleUpdateStep = (idx: number, field: string, value: string) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Workflow className="h-4 w-4 text-zinc-400" />
            Composite Multi-Step Macros
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Chain multiple discrete API operations into a single, context-efficient MCP tool for LLMs.
          </p>
        </div>

        {!isCreating && (
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Macro
          </Button>
        )}
      </div>

      {/* Creating Form */}
      {isCreating && (
        <Card className="border-white/20">
          <CardHeader>
            <CardTitle className="text-base">Define Composite Workflow</CardTitle>
            <CardDescription>
              Configure the macro tool identifier, description, and sequential execution pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300">Macro Tool Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. createCustomerAndIssueRefund"
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this composite workflow accomplishes..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Steps Editor */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-zinc-300">Execution Steps (Sequential)</label>

              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="p-3 bg-black border border-zinc-800 rounded-md space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-zinc-400 font-semibold">
                      Step {idx + 1}
                    </span>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="text-zinc-600 hover:text-white transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2">
                      <Input
                        value={step.action}
                        onChange={(e) => handleUpdateStep(idx, 'action', e.target.value)}
                        placeholder="e.g. GET /customers?email={{email}}"
                        className="text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={step.exportKey || ''}
                        onChange={(e) => handleUpdateStep(idx, 'exportKey', e.target.value)}
                        placeholder="Export key"
                        className="text-xs"
                      />
                      <Input
                        value={step.exportPath || ''}
                        onChange={(e) => handleUpdateStep(idx, 'exportPath', e.target.value)}
                        placeholder="JSONPath"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={handleAddStep} className="w-full">
                <Plus className="h-3 w-3 mr-1" /> Add Next Step
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
                Save Macro Tool
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Macros List */}
      <div className="space-y-3">
        {macros.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-xs text-zinc-500 font-mono">
              No composite macros defined yet. Click "New Macro" to build your first multi-step workflow.
            </CardContent>
          </Card>
        ) : (
          macros.map((macro) => (
            <Card key={macro.name}>
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-mono">{macro.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {macro.steps.length} Steps
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">{macro.description}</CardDescription>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteMacro(macro.name)}
                  className="text-zinc-500 hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>

              <CardContent className="space-y-2 pt-0">
                <div className="p-3 bg-black border border-zinc-800 rounded-md font-mono text-xs text-zinc-300 space-y-1.5">
                  {macro.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-zinc-600">{idx + 1}.</span>
                      <span className="text-zinc-200">{step.action}</span>
                      {step.export && (
                        <span className="text-zinc-500 text-[11px] ml-auto">
                          export: {JSON.stringify(step.export)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
