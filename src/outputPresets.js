// These are app-specific starting points, not device calibration or loudness normalization.
// Only output controls are patched; EQ, preamp, headroom, balance and bypass stay as set.
const base = { volume: 100, dynamics: 0, mono: false, width: 100, limiter: true };
const preset = (id, label, detail, changes = {}) => Object.freeze({
  id, label, detail, settings: Object.freeze({ ...base, ...changes }),
});

export const outputPresets = Object.freeze([
  preset('balanced', 'Balanced', '100% volume, original stereo width and no dynamics compression.'),
  preset('gentle', 'Gentle', 'Softens louder passages while leaving quieter parts alone.', { dynamics: 1 }),
  preset('night', 'Night', 'Stronger control of loud passages for quiet listening.', { dynamics: 2 }),
  preset('boost125', 'Boost 125%', '125% volume with peak limiting.', { volume: 125 }),
  preset('boost150', 'Boost 150%', '150% volume with peak limiting.', { volume: 150 }),
  preset('mono', 'Mono', 'Combines the left and right channels into a mono mix.', { mono: true }),
  preset('narrow', 'Narrow stereo', 'Brings the left and right sides closer together.', { width: 60 }),
  preset('wide', 'Wide stereo', 'Widens existing stereo detail; mono recordings stay mono.', { width: 125 }),
]);

export function findOutputPreset(sound) {
  return outputPresets.find(({ settings }) => Object.entries(settings).every(([key, value]) => sound[key] === value)) || null;
}
