'use client';

import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from './ui/Popover';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Check, ChevronDown, Plus, Sparkles, Globe } from 'lucide-react';
import { Badge } from './ui/Badge';

const PRESET_MODELS = [
  { id: 'zai/glm-5.3-flash', name: 'ZAI GLM 5.3 Flash', provider: 'zai' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o', provider: 'openai' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini', provider: 'openai' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Anthropic Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'anthropic/claude-3-5-haiku', name: 'Anthropic Claude 3.5 Haiku', provider: 'anthropic' },
  { id: 'google/gemini-1.5-pro', name: 'Google Gemini 1.5 Pro', provider: 'google' },
  { id: 'google/gemini-1.5-flash', name: 'Google Gemini 1.5 Flash', provider: 'google' },
  { id: 'meta/llama-3.3-70b', name: 'Meta Llama 3.3 70B', provider: 'meta' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
];

interface ModelSelectorDropdownProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelectorDropdown({ value, onChange }: ModelSelectorDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = PRESET_MODELS.filter(
    (m) =>
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCustom = searchQuery.trim().length > 0 && !PRESET_MODELS.some((m) => m.id === searchQuery.trim());

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-8 px-2.5 bg-background border-input text-foreground hover:bg-accent hover:text-accent-foreground font-sans text-xs justify-between gap-2 max-w-[260px] truncate cursor-pointer"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{value}</span>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-2 text-xs font-sans" align="start">
        {/* Search / Custom Model Input */}
        <div className="p-1 pb-2 border-b border-border">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                e.preventDefault();
                handleSelect(searchQuery.trim());
              }
            }}
            placeholder="Search or type custom provider/model..."
            className="h-8 text-xs font-sans"
            autoFocus
          />
        </div>

        {/* Custom model insertion prompt */}
        {isCustom && (
          <div
            onClick={() => handleSelect(searchQuery.trim())}
            className="mt-2 p-2 rounded bg-muted/60 border border-border hover:border-foreground text-foreground flex items-center gap-2 cursor-pointer transition-colors font-sans"
          >
            <Plus className="h-3.5 w-3.5 text-foreground shrink-0" />
            <div className="flex-1 truncate font-sans">
              <span className="text-[10px] text-muted-foreground block font-sans">Use custom provider/model:</span>
              <span className="font-semibold text-foreground truncate block font-sans">{searchQuery.trim()}</span>
            </div>
            <Badge variant="default" className="text-[9px] py-0 px-1 font-sans">
              Custom
            </Badge>
          </div>
        )}

        {/* Preset Models List */}
        <div className="mt-2 max-h-56 overflow-y-auto space-y-1 font-sans">
          {filtered.length === 0 && !isCustom ? (
            <div className="py-6 text-center text-muted-foreground text-xs font-sans">
              No matching model. Press Enter to use "{searchQuery}".
            </div>
          ) : (
            filtered.map((m) => {
              const isSelected = value === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors font-sans ${
                    isSelected
                      ? 'bg-accent border border-border text-accent-foreground font-semibold'
                      : 'hover:bg-muted text-foreground border border-transparent'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate text-xs font-semibold text-foreground font-sans">{m.name}</span>
                    <span className="truncate text-[10px] text-muted-foreground font-sans">{m.id}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="text-[9px] py-0 px-1 font-sans">
                      {m.provider}
                    </Badge>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
