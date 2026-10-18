// src/ai/chat/runToolLoop.ts
/** The tool-calling loop of one chat turn. */
import type { AiMessage, AiResponse, AiTool } from '@core/shared/aiTypes';
import type { DisplayMessage } from './aiConnectionDefaults';
import { runToolCallRound } from './runToolCallRound';
import { onlyActingTools } from './onlyActingTools';

// The turn has no step limit: the user's Stop button is the only way to end it early. A nudge every few rounds keeps a stuck model from silently spinning.
const NUDGE_EVERY_ROUNDS = 6;
// After this many rounds of only looking things up, the model loses the lookup tools so it has to act or answer.
const MAX_LOOKUP_ONLY_ROUNDS = 3;
const MAX_EMPTY_REPLY_RETRIES = 2;
const EMPTY_REPLY_NUDGE =
  'Your last reply was empty and nothing has been changed yet. Continue the user\'s request now by calling a tool, or say in one plain sentence what is blocking you.';

type SetDisplay = React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
type SendFn = (messages: AiMessage[], tools: AiTool[]) => Promise<AiResponse>;

const setStatus = (set: SetDisplay, statusId: string, content: string) =>
  set((prev) => prev.map((m) => (m.id === statusId ? { ...m, content } : m)));

export interface ToolLoopInput {
  response: AiResponse;
  sendFn: SendFn;
  tools: AiTool[];
  activeMessages: AiMessage[];
  statusId: string;
  val: (input?: unknown) => string;
  sourceEditingEnabled: boolean;
  sourceEditConfirmed: boolean;
  setSourceEditConfirmed: (v: boolean) => void;
  setDisplayMessages: SetDisplay;
  refreshRegistry: () => Promise<void>;
  onContentChanged?: () => void;
  stopRef: React.RefObject<boolean>;
  /** Called after each round's tool results are appended, with the full message list so far. */
  onRound?: (messages: AiMessage[]) => void;
}

export interface ToolLoopOutcome {
  response: AiResponse;
  rounds: number;
  calledAnyTool: boolean;
  calledWriteTool: boolean;
  successfulWriteToolNames: string[];
  /** Rounds in a row that changed nothing. */
  lookupOnlyStreak: number;
}

const LOOKUP_ONLY_NUDGE =
  'You have only looked things up for several steps and changed nothing. You already have the scene id and block ids in the context. Make the change now with apply_scene_ops (or create_custom_canvas / generate_uml_diagram), or tell the user in one plain sentence what you need.';

const STUCK_NUDGE =
  'You have used many tool calls this turn. If a step keeps failing, stop retrying it: apply the change directly with apply_scene_ops on the block you were given, or tell the user in one plain sentence what is blocking you.';

type RoundResult = Awaited<ReturnType<typeof runToolCallRound>>;

function mergeRound(out: ToolLoopOutcome, res: RoundResult): void {
  out.calledAnyTool = out.calledAnyTool || res.calledAnyTool;
  out.calledWriteTool = out.calledWriteTool || res.calledWriteTool;
  out.successfulWriteToolNames.push(...res.successfulWriteToolNames);
}

async function executeOneToolRound(
  input: ToolLoopInput,
  out: ToolLoopOutcome,
  texts: string[]
): Promise<void> {
  const { sendFn, tools, activeMessages, statusId, setDisplayMessages } = input;
  out.rounds++;
  activeMessages.push({ role: 'assistant', content: out.response.text || null, tool_calls: out.response.toolCalls });
  const res = await runToolCallRound({
    toolCalls: out.response.toolCalls!, activeMessages, statusId, val: input.val,
    sourceEditingEnabled: input.sourceEditingEnabled, sourceEditConfirmed: input.sourceEditConfirmed,
    setSourceEditConfirmed: input.setSourceEditConfirmed, setDisplayMessages,
    refreshRegistry: input.refreshRegistry, onContentChanged: input.onContentChanged, stopRef: input.stopRef,
  });
  mergeRound(out, res);
  out.lookupOnlyStreak = res.calledWriteTool ? 0 : out.lookupOnlyStreak + 1;
  input.onRound?.(activeMessages);

  if (input.stopRef.current) return;
  if (out.rounds % NUDGE_EVERY_ROUNDS === 0) activeMessages.push({ role: 'system', content: STUCK_NUDGE });
  const lookupOnly = out.lookupOnlyStreak >= MAX_LOOKUP_ONLY_ROUNDS;
  if (lookupOnly && out.lookupOnlyStreak === MAX_LOOKUP_ONLY_ROUNDS) activeMessages.push({ role: 'system', content: LOOKUP_ONLY_NUDGE });
  setStatus(setDisplayMessages, statusId, '__status__generating');
  out.response = await sendFn(activeMessages, lookupOnly ? onlyActingTools(tools) : tools);
  await retryIfSilentStop(input, out);
  if (out.response.text?.trim()) texts.push(out.response.text.trim());
}

const isSilentStop = (out: ToolLoopOutcome) =>
  !out.response.toolCalls?.length && !out.response.text?.trim() && !out.calledWriteTool;

// An empty reply with no tool call before any write is the model giving up silently; push it to continue instead of ending the turn.
async function retryIfSilentStop(input: ToolLoopInput, out: ToolLoopOutcome): Promise<void> {
  for (let retry = 0; retry < MAX_EMPTY_REPLY_RETRIES && isSilentStop(out); retry++) {
    input.activeMessages.push({ role: 'system', content: EMPTY_REPLY_NUDGE });
    out.response = await input.sendFn(input.activeMessages, input.tools);
  }
}

/** Runs tool calls and re-asks the model until it stops calling tools or the user stops it. */
export async function runToolLoop(input: ToolLoopInput): Promise<ToolLoopOutcome> {
  const { stopRef } = input;
  const out: ToolLoopOutcome = {
    response: input.response, rounds: 0, calledAnyTool: false, calledWriteTool: false,
    successfulWriteToolNames: [], lookupOnlyStreak: 0,
  };

  const texts: string[] = [];
  if (input.response.text?.trim()) texts.push(input.response.text.trim());

  while (out.response.toolCalls?.length && !stopRef.current) {
    await executeOneToolRound(input, out, texts);
  }
  if (texts.length > 0) {
    out.response = { ...out.response, text: texts.join('\n\n') };
  }
  return out;
}
