// src/components/courseHub/funnyTopicTitle.ts
/** Easter egg: a topic saved with an empty title gets one of these jokes instead of failing. */
import { HUB_TEXT } from '@i18n';

const FUNNY_TITLE_KEYS = [
  HUB_TEXT.funnyTopicName1,
  HUB_TEXT.funnyTopicName2,
  HUB_TEXT.funnyTopicName3,
  HUB_TEXT.funnyTopicName4,
  HUB_TEXT.funnyTopicName5,
  HUB_TEXT.funnyTopicName6,
  HUB_TEXT.funnyTopicName7,
  HUB_TEXT.funnyTopicName8,
] as const;

// The random source is injectable so a test can pick a known joke.
export function pickFunnyTopicTitle(random: () => number = Math.random): (typeof FUNNY_TITLE_KEYS)[number] {
  return FUNNY_TITLE_KEYS[Math.floor(random() * FUNNY_TITLE_KEYS.length)];
}
