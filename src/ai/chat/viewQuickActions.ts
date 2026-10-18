// src/ai/chat/viewQuickActions.ts
import { AI_TEXT } from '../../i18n/dictionary';
import type { LocalizedText } from '../../i18n/localizedValue';
import { translateAi } from '../../i18n/ai/translateAi';
import type { AppViewContext } from '../../core/shared/appViewContext';
import type { ViewCommands } from '../context/viewCommands';
import { quickActionsFor, type ChatContext } from './quickActions';

export interface ViewQuickAction {
  id: string;
  label: LocalizedText | string;
  prompt: LocalizedText | string;
  command?: (commands: ViewCommands) => void;
}

function canvasActions(commands: ViewCommands, lang: string): ViewQuickAction[] {
  const actions: ViewQuickAction[] = [
    { id: 'fix-page', label: AI_TEXT.quickFixPage, prompt: AI_TEXT.quickFixPagePrompt },
    { id: 'explain-page', label: AI_TEXT.askAiExplainPage, prompt: AI_TEXT.askAiExplainPagePrompt },
  ];
  if (commands.undo) {
    actions.push({
      id: 'undo',
      label: translateAi('viewActions.undo', lang),
      prompt: '',
      command: (cmd) => cmd.undo?.(),
    });
  }
  if (commands.redo) {
    actions.push({
      id: 'redo',
      label: translateAi('viewActions.redo', lang),
      prompt: '',
      command: (cmd) => cmd.redo?.(),
    });
  }
  return actions;
}

// Step number sits between two translated fragments, so word order stays per-language without placeholder syntax.
function stepPlayerActions(stepIndex: number, commands: ViewCommands, lang: string): ViewQuickAction[] {
  const stepNum = String(stepIndex + 1);
  const actions: ViewQuickAction[] = [
    {
      id: 'change-step',
      label: [translateAi('viewActions.changeStep.label', lang), stepNum].join(' '),
      prompt: [
        translateAi('viewActions.changeStep.promptStart', lang),
        stepNum,
        translateAi('viewActions.changeStep.promptEnd', lang),
      ].join(' '),
    },
  ];
  if (commands.previousStep) {
    actions.push({
      id: 'prev-step',
      label: translateAi('viewActions.previousStep', lang),
      prompt: '',
      command: (cmd) => cmd.previousStep?.(),
    });
  }
  if (commands.replayStep) {
    actions.push({
      id: 'replay-step',
      label: translateAi('viewActions.replayStep', lang),
      prompt: '',
      command: (cmd) => cmd.replayStep?.(),
    });
  }
  return actions;
}

export function viewQuickActionsFor(
  ctx: AppViewContext | null,
  fallbackContext: ChatContext,
  commands: ViewCommands = {},
  lang: string
): ViewQuickAction[] {
  if (!ctx) {
    return quickActionsFor(fallbackContext);
  }
  if (ctx.kind === 'canvas') {
    return canvasActions(commands, lang);
  }
  if (ctx.kind === 'stepPlayer') {
    return stepPlayerActions(ctx.stepIndex, commands, lang);
  }
  return quickActionsFor(fallbackContext);
}
