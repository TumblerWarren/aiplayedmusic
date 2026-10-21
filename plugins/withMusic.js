const { withAndroidManifest } = require('expo/config-plugins');
module.exports = config => withAndroidManifest(config, mod => {
  const manifest = mod.modResults.manifest;
  for (const permission of manifest['uses-permission'] || []) {
    if (permission.$?.['android:name'] === 'android.permission.READ_EXTERNAL_STORAGE') permission.$['android:maxSdkVersion'] = '32';
  }
  const application = manifest.application[0].$;
  application['android:allowBackup'] = 'false';
  application['android:label'] = '@string/app_name';
  application['android:icon'] = '@mipmap/aiplayed_launcher';
  application['android:roundIcon'] = '@mipmap/aiplayed_launcher';
  return mod;
});
