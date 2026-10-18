// src/components/ai/AiMessageList.tsx
import { useRef } from 'react';
import type { DisplayMessage } from '../../ai/chat/aiConnectionDefaults';
import type { TranslateFn } from '@i18n';
import { Sparkles } from 'lucide-react';
import { AI_TEXT } from '../../i18n/dictionary';
import { Latex } from '@engine/latex';
import type { LocalizedText } from '../../i18n/localizedValue';
import { ToolCallCard } from './ToolCallCard';
import { splitFencedCode } from './messageSegments';
import { CodeBlock } from './CodeBlock';
import { StreamingIndicator } from './StreamingIndicator';
import { useStickToBottom } from './useStickToBottom';
import { ScrollToBottomButton } from './ScrollToBottomButton';

const STATUS_LABELS: Record<string, LocalizedText> = {
  reading: AI_TEXT.statusReading,
  searching: AI_TEXT.statusSearching,
  generating: AI_TEXT.statusGenerating,
  executing: AI_TEXT.statusExecuting,
  connecting: AI_TEXT.statusConnecting,
  idle: AI_TEXT.statusIdle,
};

function statusLabel(val: TranslateFn, statusKey: string): string {
  const [statusBase, toolName, retryDelaySeconds] = statusKey.split(':');
  if (statusBase === 'calling' && toolName) return `${val(AI_TEXT.statusExecuting)} (${toolName})`;
  if (statusBase === 'retrying') return `${val(AI_TEXT.statusRetrying)} #${toolName} (${retryDelaySeconds}s)`;
  return STATUS_LABELS[statusKey] ? val(STATUS_LABELS[statusKey]) : statusKey;
}

function StatusMessage({ val, statusKey, elapsedSeconds }: { val: TranslateFn; statusKey: string; elapsedSeconds: number }) {
  const statusBase = statusKey.split(':')[0];
  const isActive = statusBase !== 'idle' && statusBase !== 'reading';
  return (
    <div className="ai-status-container">
      <div className={`ai-status-badge ${isActive ? '' : 'idle'}`}>
        <span className="status-dot" />
        {statusLabel(val, statusKey)}
        {isActive && <span className="ai-status-elapsed"> · {elapsedSeconds}s</span>}
      </div>
    </div>
  );
}

function MessageBubbleContent({ content, val }: { content: string; val: TranslateFn }) {
  const segments = splitFencedCode(content);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.kind === 'code' ? (
          <CodeBlock key={idx} code={seg.code} language={seg.language} val={val} />
        ) : (
          <Latex key={idx} text={seg.text} />
        )
      )}
    </>
  );
}

function MessageBubble({ msg, isStreaming, val }: { msg: DisplayMessage; isStreaming?: boolean; val: TranslateFn }) {
  if (!msg.content && !msg.thought) return null;
  return (
    <div className={`ai-message-item ${msg.role}`} dir="auto">
      {msg.thought && (
        <details className="ai-thought-details">
          <summary className="ai-thought-summary">
            <Sparkles size={12} className="ai-thought-icon" /> {val(AI_TEXT.thinkingProcess)}
          </summary>
          <div className="ai-thought-body">
            <Latex text={msg.thought} />
          </div>
        </details>
      )}
      {msg.content && <MessageBubbleContent content={msg.content} val={val} />}
      {isStreaming && <StreamingIndicator />}
    </div>
  );
}

const isStatus = (msg: DisplayMessage) => msg.content.startsWith('__status__');

interface AiMessageListProps {
  val: (input?: unknown) => string;
  messages: DisplayMessage[];
  isSending: boolean;
  elapsedSeconds: number;
  messageEndRef?: React.RefObject<HTMLDivElement>;
}

export function AiMessageList({
  val,
  messages,
  isSending,
  elapsedSeconds,
  messageEndRef,
}: AiMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isAtBottom, scrollToBottom } = useStickToBottom(containerRef, messages);

  if (messages.length === 0) return <div className="ai-message-list" ref={containerRef} />;

  const statusMsg = messages.find(isStatus);
  const nonStatusMessages = messages.filter((msg) => !isStatus(msg));
  const lastIndex = nonStatusMessages.length - 1;

  return (
    <div className="ai-message-list" ref={containerRef}>
      {nonStatusMessages.map((msg, idx) => {
        if (msg.role === 'tool') return <ToolCallCard key={msg.id} msg={msg} />;
        const isStreaming = isSending && idx === lastIndex && msg.role === 'assistant';
        return (
          <div key={msg.id}>
            <MessageBubble msg={msg} isStreaming={isStreaming} val={val} />
          </div>
        );
      })}

      {statusMsg && (
        <StatusMessage
          val={val}
          statusKey={statusMsg.content.replace('__status__', '')}
          elapsedSeconds={elapsedSeconds}
        />
      )}

      <div ref={messageEndRef} />
      {!isAtBottom && <ScrollToBottomButton onClick={scrollToBottom} val={val} />}
    </div>
  );
}
