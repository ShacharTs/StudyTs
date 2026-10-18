import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, BookOpen, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { MCP_TEXT } from '../../i18n/dictionary';
import '../../styles/mcpTutorial.css';
import styles from './McpTutorialModal.module.css';
import type { TranslateFn } from '@i18n';

interface TestStepProps {
  val: TranslateFn;
  testText: string;
  setTestText: (text: string) => void;
  testStatus: 'idle' | 'sending' | 'success' | 'error';
  testOutput: string | null;
  onSend: () => void;
}

function TestStep({ val, testText, setTestText, testStatus, testOutput, onSend }: TestStepProps) {
  return (
        <div>
          <h3 className={styles.stepTitle}>{val(MCP_TEXT.step3Title)}</h3>
          <p className={`${styles.stepDesc} ${styles.spaced10}`}>{val(MCP_TEXT.step3Desc)}</p>
          <div className="mcp-sandbox-area">
            <textarea className="mcp-sandbox-textarea" value={testText} onChange={(e) => setTestText(e.target.value)} placeholder={val(MCP_TEXT.testSnippetPlaceholder)} />
            <button type="button" disabled={testStatus === 'sending' || !testText.trim()} onClick={onSend} className={`mcp-btn primary ${styles.alignStart}`}>
              {testStatus === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {val(MCP_TEXT.testSendBtn)}
            </button>
            {testOutput && (
              <div>
                <div className={`${styles.result} ${testStatus === 'success' ? styles.ok : styles.fail}`}>
                  {testStatus === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {testStatus === 'success' ? val(MCP_TEXT.testSuccess) : val(MCP_TEXT.testFailed)}
                </div>
                <pre className="mcp-sandbox-output">{testOutput}</pre>
              </div>
            )}
          </div>
        </div>
  );
}

function TemplatesStep({ val }: { val: TranslateFn }) {
  return (
        <div>
          <h3 className={styles.stepTitle}>{val(MCP_TEXT.step2Title)}</h3>
          <p className={`${styles.stepDesc} ${styles.spaced12}`}>{val(MCP_TEXT.step2Desc)}</p>
          <div className="mcp-template-grid">
            <div className="mcp-template-card">
              <div className={styles.cardTitle}>
                <BookOpen size={14} color="var(--ac)" /> StudyTs-MCP
              </div>
              <div className={styles.cardHint}>Starts automatically with the backend. Notebooks, course database and authoring tools.</div>
            </div>
          </div>
        </div>
  );
}

function IntroStep({ val }: { val: TranslateFn }) {
  return (
        <div>
          <h3 className={styles.stepTitle}>{val(MCP_TEXT.step1Title)}</h3>
          <p className={`${styles.stepDesc} ${styles.lead}`}>{val(MCP_TEXT.step1Desc)}</p>
          <div className={styles.callout}>
            <div className={styles.calloutTitle}>✨ Why MCP matters:</div>
            <ul className={styles.calloutList}>
              <li>Local execution: All subprocesses run safely on your machine.</li>
              <li>Zero AI lock-in: Works with Claude, GPT-4o, Gemini, DeepSeek.</li>
              <li>Extensible: Easily build custom python/node tool bridges.</li>
            </ul>
          </div>
        </div>
  );
}

interface McpTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  val: (input?: unknown) => string;
}

export const McpTutorialModal: React.FC<McpTutorialModalProps> = ({ isOpen, onClose, val }) => {
  const [step, setStep] = useState(1);
  const [testText, setTestText] = useState('$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$ — Verified arithmetic formula.');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestSend = async () => {
    setTestStatus('sending');
    setTestOutput(null);
    try {
      const res = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: 'studyts-mcp',
          toolName: 'save_note_to_notebook',
          args: { title: 'Tutorial Sandbox Note', content: testText, tags: ['tutorial', 'math'] },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Server error');
      setTestStatus('success');
      setTestOutput(JSON.stringify(data.result, null, 2));
    } catch (err) {
      setTestStatus('error');
      setTestOutput(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mcp-tutorial-backdrop" onClick={onClose}>
      <div className="mcp-tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mcp-tutorial-header">
          <div className={styles.headerTitle}>
            <Sparkles size={16} color="var(--ac)" />
            {val(MCP_TEXT.tutorialTitle)}
          </div>
          <button type="button" className={`mcp-btn ${styles.closeBtn}`} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="mcp-tutorial-body">
          <div className="mcp-stepper">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`mcp-step-dot ${step === s ? 'active' : ''}`}>{s}</div>
            ))}
          </div>

          {step === 1 && <IntroStep val={val} />}
          {step === 2 && <TemplatesStep val={val} />}
          {step === 3 && (
            <TestStep val={val} testText={testText} setTestText={setTestText} testStatus={testStatus} testOutput={testOutput} onSend={handleTestSend} />
          )}
        </div>

        <div className="mcp-tutorial-footer">
          <button type="button" className="mcp-btn" disabled={step <= 1} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={13} /> {val(MCP_TEXT.prevStep)}
          </button>
          {step < 3 ? (
            <button type="button" className="mcp-btn primary" onClick={() => setStep(step + 1)}>
              {val(MCP_TEXT.nextStep)} <ArrowRight size={13} />
            </button>
          ) : (
            <button type="button" className="mcp-btn primary" onClick={onClose}>
              {val(MCP_TEXT.close)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
