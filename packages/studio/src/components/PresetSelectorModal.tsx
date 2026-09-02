import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Search, X, Layers, Shield, ArrowRight, Sparkles } from 'lucide-react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0b101b] border border-slate-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0e1422]">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              60+ Curated MCP API Presets
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 border-b border-slate-800/80 bg-[#090d16] space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 60+ presets by name, description, tags (e.g. stripe, postgres, email, ai)..."
              className="pl-9 bg-[#0d131f]"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
        </div>

        {/* Preset Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {isLoading ? (
            <div className="col-span-2 py-16 text-center text-slate-500">
              Loading presets...
            </div>
          ) : presets.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-slate-500">
              No presets matching '{searchQuery}'
            </div>
          ) : (
            presets.map((preset) => (
              <div
                key={preset.id}
                onClick={() => {
                  onSelectPreset(preset.id);
                  onClose();
                }}
                className="group border border-slate-800/90 hover:border-blue-500/60 bg-[#0d131f]/70 hover:bg-[#111927] rounded-lg p-4 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h3 className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors text-sm flex items-center gap-1.5">
                        {preset.name}
                        <Badge variant="outline" className="text-[10px] font-mono">
                          @{preset.id}
                        </Badge>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <Badge variant="secondary" className="text-[10px]">
                      {preset.category}
                    </Badge>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Shield className="h-3 w-3 text-amber-400/80" />
                      {preset.authType}
                    </span>
                    {preset.macros && preset.macros.length > 0 && (
                      <Badge variant="success" className="text-[10px]">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        {preset.macros.length} macro{preset.macros.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-blue-400 font-medium">
                  <span>Load Preset Workbench</span>
                  <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
