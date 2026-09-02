'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from './ui/Command';
import { ScrollArea } from './ui/ScrollArea';
import { Layers, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { Preset } from '@postmcp/types';

interface PresetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetId: string) => void;
}

export function PresetSelectorModal({
  isOpen,
  onClose,
  onSelectPreset,
}: PresetSelectorModalProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch(`/api/presets?category=${selectedCategory}&q=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          setPresets(data.presets || []);
          if (data.categories) setCategories(data.categories);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, selectedCategory, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b border-slate-800 bg-[#0e1422]">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-400" />
            60+ Curated MCP API Presets
          </DialogTitle>
          <DialogDescription>
            Select a context-optimized preset with preconfigured field masks, macros, and auth rules.
          </DialogDescription>
        </DialogHeader>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-3 bg-[#090d16] border-b border-slate-800/80 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Presets' : cat}
            </button>
          ))}
        </div>

        {/* Command Search List */}
        <Command className="bg-[#090d16] flex-1">
          <CommandInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Fuzzy search 60+ presets by name, description, tags (e.g. stripe, postgres, email)..."
          />

          <ScrollArea className="h-[420px] p-3">
            {isLoading ? (
              <div className="py-16 text-center text-xs text-slate-500">Loading presets...</div>
            ) : presets.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500">No matching presets found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => {
                      onSelectPreset(preset.id);
                      onClose();
                    }}
                    className="group border border-slate-800/90 hover:border-blue-500/60 bg-[#0d131f]/70 hover:bg-[#111927] rounded-lg p-3.5 cursor-pointer transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors text-xs flex items-center gap-1.5">
                          {preset.name}
                          <Badge variant="outline" className="text-[10px] font-mono">
                            @{preset.id}
                          </Badge>
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/50">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px]">
                          {preset.category}
                        </Badge>
                        {preset.macros && preset.macros.length > 0 && (
                          <Badge variant="success" className="text-[9px]">
                            <Sparkles className="h-2 w-2 mr-0.5" />
                            {preset.macros.length}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                        <span>Load</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
