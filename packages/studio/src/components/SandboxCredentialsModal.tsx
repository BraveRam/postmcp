'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/Dialog';
import {
  Key,
  Plus,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  Info,
  Save,
} from 'lucide-react';
import { getScopedEnvKey } from '@/lib/env-scope';

export interface HeaderRow {
  id: string;
  key: string;
  val: string;
}

interface SandboxCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bearerToken: string;
  customHeaders: HeaderRow[];
  onSave: (bearerToken: string, customHeaders: HeaderRow[]) => void;
  specTitle?: string;
  serverUrl?: string;
}

export function SandboxCredentialsModal({
  isOpen,
  onClose,
  bearerToken: initialBearerToken,
  customHeaders: initialCustomHeaders,
  onSave,
  specTitle,
  serverUrl,
}: SandboxCredentialsModalProps) {
  const [token, setToken] = useState(initialBearerToken);
  const [headers, setHeaders] = useState<HeaderRow[]>(initialCustomHeaders);
  const [showToken, setShowToken] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [envVarName, setEnvVarName] = useState(() => getScopedEnvKey(specTitle, serverUrl));
  const [isSavingEnv, setIsSavingEnv] = useState(false);
  const [envSavedSuccess, setEnvSavedSuccess] = useState(false);
  const [envSavedMsg, setEnvSavedMsg] = useState('');
  const [existingEnvInfo, setExistingEnvInfo] = useState<{ exists: boolean; maskedValue?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const defaultEnvKey = getScopedEnvKey(specTitle, serverUrl);
      setEnvVarName(defaultEnvKey);
      setToken(initialBearerToken);
      setHeaders(
        initialCustomHeaders.length > 0
          ? initialCustomHeaders
          : [{ id: 'hdr_1', key: '', val: '' }]
      );
      setSavedSuccess(false);
      setEnvSavedSuccess(false);
      setEnvSavedMsg('');

      fetch(
        `/api/env?specTitle=${encodeURIComponent(specTitle || '')}&serverUrl=${encodeURIComponent(serverUrl || '')}&envVarName=${encodeURIComponent(defaultEnvKey)}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (data && data.exists) {
            setExistingEnvInfo({ exists: true, maskedValue: data.maskedValue });
          } else {
            setExistingEnvInfo(null);
          }
        })
        .catch(() => setExistingEnvInfo(null));
    }
  }, [isOpen, initialBearerToken, initialCustomHeaders, specTitle, serverUrl]);

  const handleAddHeader = () => {
    if (headers.length >= 10) return;
    setHeaders((prev) => [
      ...prev,
      { id: `hdr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, key: '', val: '' },
    ]);
  };

  const handleRemoveHeader = (id: string) => {
    if (headers.length <= 1) {
      setHeaders([{ id: 'hdr_1', key: '', val: '' }]);
      return;
    }
    setHeaders((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'val', value: string) => {
    setHeaders((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleApply = () => {
    const cleanedHeaders = headers.filter(
      (h) => h.key.trim().length > 0 && h.val.trim().length > 0
    );
    onSave(token.trim(), cleanedHeaders);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleClearAll = () => {
    setToken('');
    setHeaders([{ id: 'hdr_1', key: '', val: '' }]);
    onSave('', []);
  };

  const handleSaveToEnv = async () => {
    if (!envVarName.trim()) return;
    setIsSavingEnv(true);
    setEnvSavedMsg('');
    const cleanedHeaders = headers.filter(
      (h) => h.key.trim().length > 0 && h.val.trim().length > 0
    );

    try {
      const res = await fetch('/api/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specTitle,
          serverUrl,
          envVarName: envVarName.trim(),
          token: token.trim(),
          customHeaders: cleanedHeaders,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEnvSavedSuccess(true);
        setEnvSavedMsg(`Saved to ${data.envPath}`);
        setExistingEnvInfo({ exists: true, maskedValue: token.trim() ? `${token.slice(0, 4)}...` : undefined });
        onSave(token.trim(), cleanedHeaders);
        setTimeout(() => setEnvSavedSuccess(false), 3000);
      } else {
        alert(data.error || 'Failed to save to .env');
      }
    } catch (e: any) {
      alert(e.message || 'Failed to save to .env');
    } finally {
      setIsSavingEnv(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Key className="h-4 w-4 text-foreground" />
            Target API Credentials & Custom Headers
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure authentication credentials for target APIs when testing live MCP tool calls in the Sandbox.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Zero-Leakage Security Banner */}
          <div className="p-3 bg-muted/40 border border-border rounded-md flex items-start gap-2.5 text-xs">
            <ShieldCheck className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
            <div className="space-y-1 text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground block">
                Zero-Leakage LLM Architecture
              </span>
              Credentials are never passed into model prompts or exposed to the AI Gateway.
              They are securely injected by the PostMCP backend at the HTTP transport layer during live tool execution.
            </div>
          </div>

          {/* Primary Bearer Token Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Bearer Token / API Key</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                e.g. Firecrawl, Stripe, GitHub, Neon
              </span>
            </label>
            <div className="relative flex items-center">
              <Input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="fc-... or sk_test_... or bearer token"
                className="pr-10 font-sans text-xs h-9 bg-background"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Automatically injected as <code className="bg-muted px-1 py-0.5 rounded">Authorization: Bearer &lt;token&gt;</code>.
            </p>
          </div>

          {/* Custom Headers Section */}
          <div className="p-3 bg-muted/30 border border-border rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Additional Custom Headers ({headers.filter((h) => h.key.trim()).length}/10)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Headers like X-Api-Key, Organization-Id, or custom auth headers
                </span>
              </div>
              {headers.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Add Header
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {headers.map((hdr, index) => (
                <div key={hdr.id} className="flex items-center gap-2">
                  <Input
                    value={hdr.key}
                    onChange={(e) => handleUpdateHeader(hdr.id, 'key', e.target.value)}
                    placeholder={`Header Key (e.g. X-Api-Key)`}
                    className="bg-background flex-1 font-sans text-xs h-8"
                  />
                  <Input
                    value={hdr.val}
                    onChange={(e) => handleUpdateHeader(hdr.id, 'val', e.target.value)}
                    type="password"
                    placeholder="Header Value"
                    className="bg-background flex-1 font-sans text-xs h-8"
                  />
                  {headers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveHeader(hdr.id)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer shrink-0"
                      title="Remove header"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Workspace .env Persistence */}
          <div className="p-3 bg-muted/20 border border-border/80 rounded-md space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground font-sans">
                <Save className="h-3.5 w-3.5 text-primary" />
                <span>Save to Project .env File</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-sans">
                Permanent & shared with CLI
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">Key:</span>
                <Input
                  value={envVarName}
                  onChange={(e) => setEnvVarName(e.target.value)}
                  placeholder="ENV_VAR_NAME"
                  className="bg-background font-mono text-xs h-8 flex-1"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveToEnv}
                disabled={isSavingEnv || (!token.trim() && headers.every((h) => !h.key.trim()))}
                className="text-xs h-8 flex items-center gap-1.5 shrink-0 hover:bg-muted/80 font-sans"
              >
                {envSavedSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Saved to .env</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save to .env</span>
                  </>
                )}
              </Button>
            </div>

            {envSavedMsg && (
              <p className="text-[10px] text-emerald-400/90 font-mono truncate">
                {envSavedMsg}
              </p>
            )}

            {existingEnvInfo?.exists && !token && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded border border-border/40 font-sans">
                <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>
                  Currently active from environment:{' '}
                  <code className="font-mono text-foreground font-semibold">{envVarName}</code>{' '}
                  ({existingEnvInfo.maskedValue || 'set'})
                </span>
              </div>
            )}
          </div>

          {/* Environment Variable Fallback Notice */}
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-1">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
            <span>
              If credentials are not entered above, PostMCP automatically attempts to resolve matching environment variables from the server runtime (such as <code className="bg-muted px-1 py-0.2 rounded">FIRECRAWL_API_KEY</code>, <code className="bg-muted px-1 py-0.2 rounded">STRIPE_SECRET_KEY</code>, <code className="bg-muted px-1 py-0.2 rounded">GITHUB_TOKEN</code>, or <code className="bg-muted px-1 py-0.2 rounded">BEARER_TOKEN</code>).
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                className="text-xs h-8 flex items-center gap-1.5"
              >
                {savedSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span>Applied</span>
                  </>
                ) : (
                  <span>Apply Credentials</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
