const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fixSystemUI } = require('./fix-expo-system-ui.cjs');
const source = fs.readFileSync('scripts/fixtures/expo-system-ui-sdk56.kt', 'utf8');

test('SDK56 compatibility patch changes only the old Android automatic fallback and is repeatable', () => {
  const fixed = fixSystemUI(source);
  assert.equal(fixed, source.replace('AppCompatDelegate.MODE_NIGHT_AUTO_BATTERY', 'AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM // Aiplayed: phone appearance, independent of battery saver.'));
  assert.equal(fixSystemUI(fixed), fixed);
  assert(!fixed.includes('MODE_NIGHT_AUTO_BATTERY'));
});

test('an unexpected upstream theme implementation stops installation for review', () => {
  assert.throws(() => fixSystemUI(source.replace('Build.VERSION_CODES.P', 'Build.VERSION_CODES.Q')), /implementation changed/);
  assert.throws(() => fixSystemUI(source + '\nAppCompatDelegate.MODE_NIGHT_AUTO_BATTERY'), /implementation changed/);
  assert.throws(() => fixSystemUI(''), /implementation changed/);
});

test('installed Expo source is patched before native packaging', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.scripts.postinstall, 'node scripts/fix-expo-system-ui.cjs');
  assert(pkg.expo.autolinking.android.buildFromSource.includes('expo-system-ui'), 'Expo prebuilt modules ignore patched Kotlin source');
  let file;
  try { file = require.resolve('expo-system-ui/package.json'); } catch { return; }
  const path = require('node:path');
  const installed = fs.readFileSync(path.join(path.dirname(file), 'android/src/main/java/expo/modules/systemui/singletons/SystemUI.kt'), 'utf8');
  assert.equal(fixSystemUI(installed), installed, 'dependency must be patched before APK compilation');
});
