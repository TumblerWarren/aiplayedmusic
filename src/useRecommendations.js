import { useEffect, useSyncExternalStore } from 'react';
import Native from './native';
import { createRecommendationStore } from './recommendations';
export const recommendationStore = createRecommendationStore(Native);
export function useRecommendations() {
  useEffect(() => recommendationStore.start(), []);
  return [useSyncExternalStore(recommendationStore.subscribe, recommendationStore.getSnapshot, recommendationStore.getSnapshot), recommendationStore];
}
