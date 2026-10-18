// src/components/ui/topicKinds.ts
/** What a topic can open: the Canvas editor or the Step player, with the words used to name each. */
import { HUB_TEXT, useTranslation } from '@i18n';

/** The name of a topic kind in the current language, for a visible label next to its icon. */
export function useTopicKindLabel(kind: TopicKind): string {
  const { val } = useTranslation();
  return val(TOPIC_KIND_LABELS[kind]);
}

export type TopicKind = 'canvas' | 'stepPlayer' | 'file';

export const TOPIC_KIND_LABELS = {
  canvas: HUB_TEXT.topicKindCanvas,
  stepPlayer: HUB_TEXT.topicKindPlayer,
  file: HUB_TEXT.topicKindFile,
} as const;
