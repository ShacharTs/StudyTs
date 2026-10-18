// src/components/courseHub/topicCardViewModels.ts
/**
 * UI-facing ViewModel types for topic and week cards in HomeDashboard.
 * Decouples leaf UI components from raw data catalog models.
 */

import type { LocalizedValue } from '../../i18n';

export interface TopicCardViewModel {
  id: string;
  title: string | LocalizedValue;
  description: string | LocalizedValue;
  contentUrl?: string;
  kind?: 'canvas' | 'stepPlayer' | 'file';
}

export interface WeekSectionViewModel {
  title: string | LocalizedValue;
  lectures: TopicCardViewModel[];
  practice: TopicCardViewModel[];
}
