'use client';

import React from 'react';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { Dialog, DialogContent } from './ui/Dialog';
import { LiveSandbox, type SandboxMessage } from './LiveSandbox';

export interface LiveSandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  spec: NormalizedSpec;
  selectedOperation: NormalizedOperation | null;
  messages?: SandboxMessage[];
  onMessagesChange?: React.Dispatch<React.SetStateAction<SandboxMessage[]>>;
}

export function LiveSandboxModal({
  isOpen,
  onClose,
  spec,
  selectedOperation,
  messages,
  onMessagesChange,
}: LiveSandboxModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="w-[90vw] sm:w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[98vh] sm:h-[98vh] max-h-[98vh] sm:max-h-[98vh] p-0 gap-0 overflow-hidden flex flex-col rounded-xl border border-border/40 shadow-2xl bg-background font-sans outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 ring-0"
      >
        <LiveSandbox
          spec={spec}
          selectedOperation={selectedOperation}
          isModal={true}
          onClose={onClose}
          messages={messages}
          onMessagesChange={onMessagesChange}
        />
      </DialogContent>
    </Dialog>
  );
}
