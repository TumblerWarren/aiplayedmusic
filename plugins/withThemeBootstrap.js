const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');
const helper = 'app.localmusic.player.ThemePreferences';
function patchActivity(source) {
  if (source.includes('// aiplayed-theme-bootstrap')) return source;
  const signature = /override fun onCreate\(savedInstanceState: Bundle\?\)\s*\{/;
  const created = /super\.onCreate\([^)]*\)/;
  if (!signature.test(source) || !created.test(source)) throw new Error('Cannot install theme bootstrap in the generated MainActivity');
  return source.replace(signature, match => `${match}\n    // aiplayed-theme-bootstrap\n    ${helper}.restoreBeforeCreate(this)`)
    .replace(created, match => `${match}\n    ${helper}.applyWindow(this)`);
}
module.exports = config => {
  config = withAndroidManifest(config, mod => {
    const activity = mod.modResults.manifest.application[0].activity.find(item => item.$['android:name'] === '.MainActivity');
    if (!activity) throw new Error('MainActivity is required for theme bootstrap');
    const flags = new Set((activity.$['android:configChanges'] || '').split('|').filter(Boolean));
    flags.add('uiMode'); activity.$['android:configChanges'] = [...flags].join('|');
    return mod;
  });
  return withMainActivity(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('Theme bootstrap requires the Expo Kotlin MainActivity');
    mod.modResults.contents = patchActivity(mod.modResults.contents);
    return mod;
  });
};
module.exports.patchActivity = patchActivity;
