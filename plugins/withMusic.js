const { withAndroidManifest } = require('expo/config-plugins');
module.exports = config => withAndroidManifest(config, mod => {
  const manifest = mod.modResults.manifest;
  const permissions = manifest['uses-permission'] || [];
  for (const permission of permissions) {
    if (permission.$?.['android:name'] === 'android.permission.READ_EXTERNAL_STORAGE') permission.$['android:maxSdkVersion'] = '32';
  }
  manifest.application[0].$['android:allowBackup'] = 'false';
  return mod;
});
