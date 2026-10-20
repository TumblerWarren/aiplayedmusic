/** Aggregate MediaStore folder counts without applying current scan restrictions. */
export function storageRoot(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'storage' || parts.length < 2) return null;
  if (parts[1] === 'emulated') return parts.length >= 3 ? `/storage/emulated/${parts[2]}` : null;
  return `/storage/${parts[1]}`;
}

export function folderChoices(catalog, parent = null) {
  const result = new Map();
  for (const { folder, count } of catalog) {
    const root = storageRoot(folder);
    if (!root) continue;
    let path = root;
    if (parent) {
      const prefix = `${parent}/`;
      if (!folder.startsWith(prefix)) continue;
      path = prefix + folder.slice(prefix.length).split('/')[0];
    }
    result.set(path, (result.get(path) || 0) + Math.max(0, Number(count) || 0));
  }
  return [...result].sort(([a], [b]) => a.localeCompare(b)).map(([path, count]) => ({ path, count }));
}
