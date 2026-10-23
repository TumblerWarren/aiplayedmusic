export const alphabet = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

export function indexLetter(value) {
  const first = String(value || '').trim().normalize('NFKD').replace(/\p{M}/gu, '').charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

export function alphabetTargets(items, field = 'title') {
  const targets = {};
  items.forEach((item, index) => {
    const letter = indexLetter(item[field]);
    if (targets[letter] === undefined) targets[letter] = index;
  });
  return targets;
}

// Missing letters seek the closest populated section rather than doing nothing.
export function nearestLetter(fraction, targets) {
  const start = Math.max(0, Math.min(alphabet.length - 1, Math.floor(fraction * alphabet.length)));
  for (let distance = 0; distance < alphabet.length; distance++) {
    for (const index of [start + distance, start - distance]) {
      const letter = alphabet[index];
      if (letter && targets[letter] !== undefined) return letter;
    }
  }
  return null;
}
