const { withAndroidManifest, withSettingsGradle } = require('expo/config-plugins');
module.exports = config => {
  config = withSettingsGradle(config, mod => {
    const marker = "// Aiplayed standalone Java recommendation runtime";
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += `\n${marker}\ninclude ':aiplayed-recommendation-runtime'\nproject(':aiplayed-recommendation-runtime').projectDir = new File(rootProject.projectDir, '../modules/local-music/android/recommendation-runtime')\n`;
    return mod;
  });
  return withAndroidManifest(config, mod => {
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
};
