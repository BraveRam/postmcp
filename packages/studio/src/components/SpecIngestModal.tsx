'use client';

import React, { useState, useRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { Upload, Globe, FileCode, FileUp, CheckCircle2, Loader2 } from 'lucide-react';

interface SpecIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestSpec: (payload: { spec?: string; url?: string }) => Promise<void>;
}

export function SpecIngestModal({ isOpen, onClose, onIngestSpec }: SpecIngestModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'paste'>('file');
  const [url, setUrl] = useState('');
  const [rawSpec, setRawSpec] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      setError(null);
    };
    reader.onerror = () => setError('Failed to read local file.');
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (activeTab === 'file') {
        if (!fileContent) throw new Error('Please select or drop an OpenAPI file (.json, .yaml, .yml).');
        await onIngestSpec({ spec: fileContent });
      } else if (activeTab === 'url') {
        if (!url.trim()) throw new Error('Please enter a valid OpenAPI URL.');
        await onIngestSpec({ url: url.trim() });
      } else {
        if (!rawSpec.trim()) throw new Error('Please paste your OpenAPI definition.');
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!isLoading && !open) onClose();
      }}
    >
      <DialogContent
        hideCloseButton={isLoading}
        onPointerDownOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
        className="max-w-xl bg-zinc-950 border-zinc-800 text-white"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-white" />
            Import OpenAPI Specification
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? 'Fetching, dereferencing schemas, and building MCP tool AST...'
              : 'Ingest local files, remote URLs, or pasted schemas into the Studio workbench.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 font-sans">
              {error}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList className="grid grid-cols-3 w-full bg-black border-zinc-800">
              <TabsTrigger value="file" disabled={isLoading} className="flex items-center gap-1.5">
                <FileUp className="h-3.5 w-3.5" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="url" disabled={isLoading} className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Remote URL
              </TabsTrigger>
              <TabsTrigger value="paste" disabled={isLoading} className="flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5" />
                Paste Schema
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="pt-3">
              <div
                onDragOver={(e) => {
                  if (isLoading) return;
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  if (isLoading) return;
                  handleDrop(e);
                }}
                onClick={() => {
                  if (!isLoading) fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all flex flex-col items-center justify-center gap-2 ${
                  isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                } ${
                  isDragging
                    ? 'border-white bg-zinc-900'
                    : selectedFileName
                    ? 'border-zinc-500 bg-zinc-900/60'
                    : 'border-zinc-800 hover:border-zinc-600 bg-black'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="hidden"
                />
                {selectedFileName ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-white" />
                    <span className="text-xs font-sans font-semibold text-white">
                      {selectedFileName}
                    </span>
                    <span className="text-[11px] text-zinc-500">Click to choose another file</span>
                  </>
                ) : (
                  <>
                    <FileUp className="h-8 w-8 text-zinc-500" />
                    <span className="text-xs font-semibold text-zinc-200">
                      Drag & drop your OpenAPI JSON or YAML file here
                    </span>
                    <span className="text-[11px] text-zinc-500 font-sans">
                      Supports OpenAPI 3.0.x, 3.1.x, Swagger 2.0 (.json, .yaml, .yml)
                    </span>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="url" className="pt-3 space-y-2">
              <label className="text-xs font-semibold text-zinc-300">OpenAPI Spec URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                placeholder="https://api.example.com/openapi.json"
                className="bg-black"
              />
              <p className="text-[11px] text-zinc-500 font-sans">
                HTTPS URL pointing to OpenAPI 3.0 / 3.1 specification.
              </p>
            </TabsContent>

            <TabsContent value="paste" className="pt-3 space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Raw OpenAPI JSON / YAML</label>
              <textarea
                value={rawSpec}
                onChange={(e) => setRawSpec(e.target.value)}
                disabled={isLoading}
                placeholder="Paste JSON or YAML OpenAPI definition..."
                rows={8}
                className="w-full rounded-md border border-zinc-800 bg-black p-3 text-xs font-sans text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
              />
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isLoading ? 'Ingesting Specification...' : 'Ingest Specification'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
