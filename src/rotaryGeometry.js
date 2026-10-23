export function clampKnob(value, min, max) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}
export function steppedKnob(value, min, max, step) {
  'worklet';
  return clampKnob(Math.round((min + Math.round((clampKnob(value, min, max) - min) / step) * step) * 1e6) / 1e6, min, max);
}
export function rotationDelta(current, previous) {
  'worklet';
  let delta = current - previous;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
