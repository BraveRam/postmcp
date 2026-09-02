import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { X, Upload, Globe, FileCode } from 'lucide-react';

interface SpecIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestSpec: (payload: { spec?: string; url?: string }) => Promise<void>;
}

export function SpecIngestModal({ isOpen, onClose, onIngestSpec }: SpecIngestModalProps) {
  const [tab, setTab] = useState<'url' | 'paste'>('url');
  const [url, setUrl] = useState('');
  const [rawSpec, setRawSpec] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (tab === 'url') {
        if (!url.trim()) throw new Error('Please enter a valid OpenAPI URL.');
        await onIngestSpec({ url: url.trim() });
      } else {
        if (!rawSpec.trim()) throw new Error('Please paste your OpenAPI specification.');
        await onIngestSpec({ spec: rawSpec.trim() });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to ingest OpenAPI spec.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0b101b] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0e1422]">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Import OpenAPI Specification</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-[#090d16] px-6 pt-3 gap-4">
          <button
            onClick={() => setTab('url')}
            className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'url'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="h-4 w-4" />
            Remote URL
          </button>
          <button
            onClick={() => setTab('paste')}
            className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'paste'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="h-4 w-4" />
            Paste JSON / YAML
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 font-mono">
              {error}
            </div>
          )}

          {tab === 'url' ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">OpenAPI Spec URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/openapi.json or .yaml"
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                Supports OpenAPI 3.0.x, 3.1.x, Swagger 2.0 via HTTPS.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Paste OpenAPI Document</label>
              <textarea
                value={rawSpec}
                onChange={(e) => setRawSpec(e.target.value)}
                placeholder="Paste JSON or YAML OpenAPI definition here..."
                rows={10}
                className="w-full rounded-lg border border-slate-800 bg-[#0d131f] p-3 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={isLoading}>
              {isLoading ? 'Ingesting...' : 'Import & Analyze'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
