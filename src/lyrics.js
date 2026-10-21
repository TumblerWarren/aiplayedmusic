export function parseLyrics(source = '') {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const offsets = [...text.matchAll(/\[offset:\s*([+-]?\d+)\s*\]/gi)];
  const offset = Number(offsets.at(-1)?.[1] || 0);
  const timed = [];
  for (const line of text.split('\n')) {
    const stamps = [...line.matchAll(/\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g)];
    const words = line.replace(/\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g, '').trim();
    for (const stamp of stamps) {
      const time = Number(stamp[1]) * 60000 + Number(stamp[2]) * 1000 + Number((stamp[3] || '').padEnd(3, '0')) - offset;
      if (Number.isFinite(time)) timed.push({ time: Math.max(0, time), text: words });
    }
  }
  return timed.length ? { timed: true, lines: timed.sort((a, b) => a.time - b.time) }
    : { timed: false, lines: text.split('\n').map(text => ({ text })) };
}

export function currentLyric(lines, position) {
  let low = 0, high = lines.length - 1, result = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (lines[middle].time <= position) { result = middle; low = middle + 1; }
    else high = middle - 1;
  }
  return result;
}
