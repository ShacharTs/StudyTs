/** Lets anywhere in the app (e.g. the canvas right-click menu) open the AI panel with a ready-made prompt, without importing the panel. */
export const AI_PROMPT_EVENT = 'studyts:ai-prompt';

export function requestAiPrompt(prompt: string): void {
  window.dispatchEvent(new CustomEvent<{ prompt: string }>(AI_PROMPT_EVENT, { detail: { prompt } }));
}

/** Calls `handler` with each requested prompt; returns the unsubscribe function. */
export function onAiPromptRequest(handler: (prompt: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<{ prompt: string }>).detail.prompt);
  window.addEventListener(AI_PROMPT_EVENT, listener);
  return () => window.removeEventListener(AI_PROMPT_EVENT, listener);
}
