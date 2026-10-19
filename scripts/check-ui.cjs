const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const files = ['App.js', ...fs.readdirSync('src').filter(name => name.endsWith('.js')).map(name => `src/${name}`)];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr || result.error}`);
  for (const [, relative] of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(file), relative);
    if (!fs.existsSync(target) && !fs.existsSync(`${target}.js`)) throw new Error(`${file}: missing import ${relative}`);
  }
}
console.log(`UI syntax and local imports passed (${files.length} files).`);
