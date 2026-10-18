/**
 * AI Assistant modal: multi-provider direct & OmniRoute mode with tool-calling and chat history.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../../i18n';
import { useCourseRegistry } from '../../core/courseRegistry/CourseRegistryContext';
import { useAiTaskStatus } from '@ai/useAiTaskStatus';
import type { TopicContent } from '../../core/courseDataLoader';
import { AI_TEXT } from '../../i18n/dictionary';
import { ErrorBoundary } from '../shell/ErrorBoundary';
import { AiMessageList } from './AiMessageList';
import { AiComposer } from './AiComposer';
import { useAiAttachments } from './useAiAttachments';
import { useAiChatSend } from './useAiChatSend';
import { chatContextOf } from '../../ai/chat/quickActions';
import { viewQuickActionsFor } from '../../ai/chat/viewQuickActions';
import { useAppViewContextStore } from '../../ai/context/appViewContextStore';
import { useViewCommandsStore } from '../../ai/context/viewCommands';
import { onAiPromptRequest } from '../../ai/chat/aiPromptEvent';
import { useAiConnectionSettings } from './useAiConnectionSettings';
import { useAiChatPersistence } from './useAiChatPersistence';
import { useAiSendingStatus } from './useAiSendingStatus';
import { useAiPanelResize } from './useAiPanelResize';
import '../../styles/aiSettings.css';
import { Trash2, Bot } from 'lucide-react';

interface AiModalHeaderProps {
  val: (input?: unknown) => string;
}

export function AiModalHeader({ val }: AiModalHeaderProps) {
  return (
    <div className="ai-settings-header">
      <div className="ai-settings-header-title">
        <Bot size={16} color="var(--ac)" />
        <h2 dir="auto">
          {val(AI_TEXT.assistantTitle)}
        </h2>
      </div>
    </div>
  );
}

interface AiContextBannerProps {
  val: (input?: unknown) => string;
  isLoading?: boolean;
  activeCourseId?: string;
  activeTopicId?: string;
  currentTopicTitle?: string;
  hasMessages: boolean;
  onClearChat: () => void;
}

function AiContextBanner({ val, isLoading, activeCourseId, activeTopicId, currentTopicTitle, hasMessages, onClearChat }: AiContextBannerProps) {
  return (
    <div className="ai-context-banner">
      <span>
        <strong>{val(AI_TEXT.contextActive)}: </strong>
        {isLoading
          ? '…'
          : activeTopicId && activeTopicId !== 'home' && activeTopicId !== 'course-home'
            ? `${activeCourseId ?? ''} / ${currentTopicTitle || activeTopicId}`
            : activeCourseId
              ? `${activeCourseId} (Course Hub)`
              : 'Dashboard'}
      </span>
      {hasMessages && (
        <button onClick={onClearChat} title={val(AI_TEXT.clearChat)}>
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCourseId?: string;
  activeTopicId?: string;
  topicContent?: TopicContent | null;
  isLoading?: boolean;
  /** Called after any AI tool call successfully writes content/canvas data, so the open topic can be refetched. */
  onContentChanged?: () => void;
  sourceEditingEnabled: boolean;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  activeCourseId,
  activeTopicId,
  topicContent,
  isLoading,
  onContentChanged,
  sourceEditingEnabled,
}) => {
  const { val, resolveLocalized, direction, lang } = useTranslation();
  const { registry, refreshRegistry } = useCourseRegistry();
  const [, setAiStatus] = useAiTaskStatus();
  const { width, handlePointerDown, resetWidth } = useAiPanelResize(direction);

  const conn = useAiConnectionSettings();
  const persistence = useAiChatPersistence(val);
  const { chatLoaded, displayMessages, setDisplayMessages, conversationHistory, setConversationHistory, clearChat } = persistence;
  const attachmentState = useAiAttachments();

  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sourceEditConfirmed, setSourceEditConfirmed] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const elapsedSeconds = useAiSendingStatus(isSending, setAiStatus);

  const { handleSendMessage: sendChatMessage, handleStopGenerating, resumePendingTurn } = useAiChatSend({
    val,
    isOmniRoute: conn.isOmniRoute,
    activeKey: conn.activeKey,
    omniRouteModel: conn.omniRouteModel,
    omniRouteBaseUrl: '/api/omniroute/v1',
    directProvider: conn.directProvider,
    directModel: conn.directModel,
    activeProviderConfig: conn.activeProviderConfig,
    customBaseUrl: conn.customBaseUrl,
    isConnected: conn.isConnected,
    sourceEditingEnabled,
    sourceEditConfirmed,
    setSourceEditConfirmed,
    activeCourseId,
    activeTopicId,
    topicContent,
    registry,
    attachments: attachmentState.attachments,
    conversationHistory,
    setConversationHistory,
    setDisplayMessages,
    setChatInput,
    setChatError,
    setIsSending,
    setAiStatus,
    refreshRegistry,
    onContentChanged,
  });

  // "Ask AI" shortcuts elsewhere in the app (canvas right-click) hand over a prompt to review before sending.
  useEffect(() => onAiPromptRequest(setChatInput), []);

  // A reload mid-turn leaves its state in storage: once the chat and the connection are back, carry on.
  const resumeAttempted = useRef(false);
  useEffect(() => {
    if (!chatLoaded || !conn.isConnected || resumeAttempted.current) return;
    resumeAttempted.current = true;
    void resumePendingTurn();
  }, [chatLoaded, conn.isConnected, resumePendingTurn]);

  const handleBackdropClick = () => {
    if (isSending) return;
    onClose();
  };

  const currentTopicTitle = topicContent ? resolveLocalized(topicContent.title) : undefined;
  const panelStyle = { '--ai-panel-width': `${width}px` } as React.CSSProperties;

  const viewContext = useAppViewContextStore((s) => s.context);
  const viewCommands = useViewCommandsStore((s) => s.commands);
  const fallbackContext = chatContextOf(activeTopicId, Boolean(topicContent));
  const quickActions = viewQuickActionsFor(viewContext, fallbackContext, viewCommands, lang);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="ai-settings-backdrop"
          style={panelStyle}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, x: direction === 'rtl' ? '-100%' : '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === 'rtl' ? '-100%' : '100%' }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="ai-settings-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="ai-settings-resize-handle"
              onPointerDown={handlePointerDown}
              onDoubleClick={resetWidth}
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={width}
              aria-valuemin={340}
              aria-label="Resize AI assistant panel"
              title="Drag to resize / Double-click to reset"
            />
            <ErrorBoundary fallbackTitle="AI Assistant encountered an error">
              <AiModalHeader val={val} />

              {!conn.isConnected && (
                <div className="ai-settings-disconnected-banner">
                  {val(AI_TEXT.noApiKey)}
                </div>
              )}

              <AiContextBanner
                val={val}
                isLoading={isLoading}
                activeCourseId={activeCourseId}
                activeTopicId={activeTopicId}
                currentTopicTitle={currentTopicTitle}
                hasMessages={displayMessages.length > 0}
                onClearChat={() => clearChat(setChatError)}
              />

              <AiMessageList
                val={val}
                messages={displayMessages}
                isSending={isSending}
                elapsedSeconds={elapsedSeconds}
              />

              <AiComposer
                val={val}
                isSending={isSending}
                isConnected={conn.isConnected}
                quickActions={quickActions}
                viewCommands={viewCommands}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSend={() => sendChatMessage(chatInput)}
                onStop={handleStopGenerating}
                attachments={attachmentState.attachments}
                rejections={attachmentState.rejections}
                onAddFiles={attachmentState.addFiles}
                onRemoveAttachment={attachmentState.remove}
                onDismissRejection={attachmentState.dismissRejection}
                chatError={chatError}
                setChatError={setChatError}
                fileInputRef={fileInputRef}
              />
            </ErrorBoundary>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
