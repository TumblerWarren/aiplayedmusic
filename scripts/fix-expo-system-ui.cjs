// Expo SDK56 maps automatic appearance to battery saver on API26/27.
// Patch that one fallback before Android compilation; the app follows phone UI mode.
const fs = require('node:fs');
const path = require('node:path');

const battery = 'AppCompatDelegate.MODE_NIGHT_AUTO_BATTERY';
const follow = 'AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM';
function fixSystemUI(source) {
  const automatic = /"automatic" -> \{\s*if \(Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.P\) \{\s*AppCompatDelegate\.MODE_NIGHT_AUTO_BATTERY\s*\} else \{\s*AppCompatDelegate\.MODE_NIGHT_FOLLOW_SYSTEM\s*\}\s*\}/;
  if (automatic.test(source) && source.split(battery).length === 2)
    return source.replace(battery, follow + ' // Aiplayed: phone appearance, independent of battery saver.');
  if (source.includes('// Aiplayed: phone appearance, independent of battery saver.') && !source.includes(battery)) return source;
  throw new Error('Expo SystemUI automatic-theme implementation changed; review the Android 8 compatibility patch.');
}

if (require.main === module) {
  const root = path.dirname(require.resolve('expo-system-ui/package.json'));
  const file = path.join(root, 'android/src/main/java/expo/modules/systemui/singletons/SystemUI.kt');
  const source = fs.readFileSync(file, 'utf8');
  const fixed = fixSystemUI(source);
  if (fixed !== source) fs.writeFileSync(file, fixed);
  console.log('Expo automatic appearance follows phone mode on API26+.');
}
module.exports = { fixSystemUI };
