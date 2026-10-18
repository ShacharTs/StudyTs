// src/components/ai/AiComposer.tsx
import React, { useRef, useState, useCallback } from 'react';
import { Paperclip, ArrowUp, Square } from 'lucide-react';
import { AI_TEXT } from '../../i18n/dictionary';
import { ATTACHMENT_POLICY } from '../../core/shared/attachmentPolicy';
import { useAutosizeTextarea } from './useAutosizeTextarea';
import { AttachmentChips } from './AttachmentChips';
import type { AiAttachment, AttachmentRejectionItem } from './useAiAttachments';
import type { ViewCommands } from '../../ai/context/viewCommands';
import styles from './AiComposer.module.css';

export interface QuickActionItem {
  id: string;
  label: unknown;
  prompt?: unknown;
  command?: (commands: ViewCommands) => void;
}

export interface AiComposerProps {
  val: (input?: unknown) => string;
  isSending: boolean;
  isConnected: boolean;
  busy?: boolean;
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  attachments: AiAttachment[];
  rejections: AttachmentRejectionItem[];
  onAddFiles: (files: File[]) => Promise<void>;
  onRemoveAttachment: (id: string) => void;
  onDismissRejection: (id: string) => void;
  chatError: string | null;
  setChatError: (v: string | null) => void;
  quickActions?: QuickActionItem[];
  viewCommands?: ViewCommands;
  fileInputRef?: React.RefObject<HTMLInputElement>;
}

interface ActionButtonsProps {
  val: (input?: unknown) => string;
  isBusy: boolean;
  canAttach: boolean;
  canSend: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAddFiles: (files: File[]) => Promise<void>;
  onSend: () => void;
  onStop: () => void;
}

function ActionButtons({
  val,
  isBusy,
  canAttach,
  canSend,
  fileInputRef,
  onAddFiles,
  onSend,
  onStop,
}: ActionButtonsProps) {
  return (
    <div className={styles.actionsRow}>
      <button
        type="button"
        className={styles.attachBtn}
        onClick={() => fileInputRef.current?.click()}
        disabled={!canAttach}
        title={val(AI_TEXT.attachFile)}
        aria-label={val(AI_TEXT.attachFile)}
      >
        <Paperclip size={15} />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        hidden
        multiple
        accept={ATTACHMENT_POLICY.allowedExtensions.join(',')}
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            void onAddFiles(Array.from(files));
          }
          e.target.value = '';
        }}
      />

      {isBusy ? (
        <button
          type="button"
          className={styles.stopBtn}
          onClick={onStop}
          title={val(AI_TEXT.stop)}
          aria-label={val(AI_TEXT.stop)}
        >
          <Square size={13} fill="currentColor" />
        </button>
      ) : (
        <button
          type="button"
          className={styles.sendBtn}
          onClick={onSend}
          disabled={!canSend}
          title={val(AI_TEXT.send)}
          aria-label={val(AI_TEXT.send)}
        >
          <ArrowUp size={16} />
        </button>
      )}
    </div>
  );
}

function ComposerQuickActions({
  val,
  isBusy,
  isConnected,
  quickActions,
  onSelect,
  viewCommands,
}: {
  val: (input?: unknown) => string;
  isBusy: boolean;
  isConnected: boolean;
  quickActions: QuickActionItem[];
  onSelect: (p: string) => void;
  viewCommands?: ViewCommands;
}) {
  if (quickActions.length === 0) return null;
  return (
    <div className={styles.quickActions}>
      {quickActions.map((qa) => (
        <button
          key={qa.id}
          type="button"
          className={styles.quickActionBtn}
          disabled={isBusy || !isConnected}
          onClick={() => {
            if (qa.command && viewCommands) {
              qa.command(viewCommands);
            } else if (qa.prompt) {
              onSelect(val(qa.prompt));
            }
          }}
        >
          {val(qa.label)}
        </button>
      ))}
    </div>
  );
}

function ErrorBanner({
  val,
  error,
  isBusy,
  onDismiss,
}: {
  val: (i?: unknown) => string;
  error: string | null;
  isBusy: boolean;
  onDismiss: () => void;
}) {
  if (!error || isBusy) return null;
  return (
    <div className={styles.errorBanner}>
      <span>⚠️ {error}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={val(AI_TEXT.clear)}
        className={styles.dismissBtn}
      >
        {'×'}
      </button>
    </div>
  );
}

export function AiComposer({
  val,
  isSending,
  isConnected,
  busy = false,
  chatInput,
  setChatInput,
  onSend,
  onStop,
  attachments,
  rejections,
  onAddFiles,
  onRemoveAttachment,
  onDismissRejection,
  chatError,
  setChatError,
  quickActions = [],
  viewCommands,
  fileInputRef: externalFileInputRef,
}: AiComposerProps) {
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = externalFileInputRef || internalFileInputRef;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useAutosizeTextarea(textareaRef, chatInput);

  const isBusy = isSending || busy;
  const canSend = isConnected && !isBusy && (chatInput.trim().length > 0 || attachments.length > 0);
  const canAttach = !isBusy && attachments.length < ATTACHMENT_POLICY.maxCount;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isComposing =
        Boolean(e.nativeEvent?.isComposing) ||
        Boolean((e as unknown as { isComposing?: boolean })?.isComposing) ||
        e.keyCode === 229;
      if (isComposing) return;
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        void onAddFiles(Array.from(files));
      }
    },
    [onAddFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        void onAddFiles(Array.from(files));
      }
    },
    [onAddFiles]
  );

  return (
    <div className={styles.wrapper}>
      <ComposerQuickActions
        val={val}
        isBusy={isBusy}
        isConnected={isConnected}
        quickActions={quickActions}
        onSelect={setChatInput}
        viewCommands={viewCommands}
      />

      <ErrorBanner
        val={val}
        error={chatError}
        isBusy={isBusy}
        onDismiss={() => setChatError(null)}
      />

      <div
        className={`${styles.composerCard} ${isDragOver ? styles.dragOver : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={handleDrop}
      >
        <AttachmentChips
          val={val}
          attachments={attachments}
          rejections={rejections}
          onRemove={onRemoveAttachment}
          onDismissRejection={onDismissRejection}
        />

        <div className={styles.inputRow}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={val(AI_TEXT.chatPlaceholder)}
            disabled={isBusy || !isConnected}
            dir="auto"
            rows={1}
          />

          <ActionButtons
            val={val}
            isBusy={isBusy}
            canAttach={canAttach}
            canSend={canSend}
            fileInputRef={fileInputRef}
            onAddFiles={onAddFiles}
            onSend={onSend}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}
