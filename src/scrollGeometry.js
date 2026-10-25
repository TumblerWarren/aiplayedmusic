export function headerRemaining(offset, header, focused = false, scrollable = true) {
  'worklet';
  return focused || !scrollable ? header : Math.max(0, header - Math.max(0, offset));
}
export function railFraction(pageY, top, height, padding = 4) {
  'worklet';
  return Math.max(0, Math.min(0.999999, (pageY - top - padding) / Math.max(1, height - 2 * padding)));
}

// Diff-clamp scroll deltas: reveal search on upward movement at any depth.
export function nextHeaderHidden(hidden, previous, next, height, focused = false, scrollable = true, viewportDelta = 0) {
  'worklet';
  if (focused || !scrollable) return 0;
  return Math.max(0, Math.min(height, hidden + Math.max(0, next) - Math.max(0, previous) + viewportDelta));
}
