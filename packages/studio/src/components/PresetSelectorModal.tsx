'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Command, CommandInput } from './ui/Command';
import { ScrollArea } from './ui/ScrollArea';
import { Layers, Sparkles, ArrowRight } from 'lucide-react';
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
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-zinc-950 border-zinc-800">
        <DialogHeader className="p-4 pb-3 border-b border-zinc-800 bg-black">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-white" />
            60+ Curated MCP API Presets
          </DialogTitle>
          <DialogDescription>
            Select a context-optimized preset with preconfigured field masks, macros, and auth rules.
          </DialogDescription>
        </DialogHeader>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-3 bg-zinc-950 border-b border-zinc-800 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap text-xs font-sans cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-white text-black font-semibold shadow-xs'
                  : 'bg-black text-zinc-400 hover:bg-zinc-900 hover:text-white border border-zinc-800'
              }`}
            >
              {cat === 'all' ? 'All Presets' : cat}
            </button>
          ))}
        </div>

        {/* Command Search List */}
        <Command className="bg-zinc-950 flex-1">
          <CommandInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search 60+ presets (e.g. stripe, github, slack, shopify)..."
            className="bg-zinc-950 border-zinc-800 text-white"
          />

          <ScrollArea className="h-[400px] p-3">
            {isLoading ? (
              <div className="py-16 text-center text-xs text-zinc-500 font-sans">Loading presets...</div>
            ) : presets.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 font-sans">No matching presets found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => {
                      onSelectPreset(preset.id);
                      onClose();
                    }}
                    className="group border border-zinc-800 hover:border-zinc-500 bg-black hover:bg-zinc-900/60 rounded-md p-3.5 cursor-pointer transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-zinc-100 group-hover:text-white transition-colors text-xs flex items-center gap-1.5 font-sans">
                          {preset.name}
                          <Badge variant="outline" className="text-[10px] font-sans">
                            @{preset.id}
                          </Badge>
                        </h3>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px]">
                          {preset.category}
                        </Badge>
                        {preset.macros && preset.macros.length > 0 && (
                          <Badge variant="outline" className="text-[9px]">
                            <Sparkles className="h-2 w-2 mr-0.5" />
                            {preset.macros.length} Macros
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-zinc-300 font-sans group-hover:text-white">
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
