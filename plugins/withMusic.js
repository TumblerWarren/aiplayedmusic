const path = require('node:path');
const { withAndroidManifest, withAndroidStyles, XML } = require('expo/config-plugins');

module.exports = config => {
  config = withAndroidManifest(config, mod => {
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
  return withAndroidStyles(config, async mod => {
    // SDK 56 emits this API 33 setting into values/styles.xml. Keep the full
    // splash style on Android 8+, and put the framework-only item in values-v33.
    const splash = mod.modResults.resources.style?.find(style => style.$.name === 'Theme.App.SplashScreen');
    if (!splash) throw new Error('The branded splash theme must be generated before withMusic.');
    const compatible = (splash.item || []).filter(item => item.$.name !== 'android:windowSplashScreenBehavior');
    const qualified = JSON.parse(JSON.stringify({ ...splash, item: [...compatible, { $: { name: 'android:windowSplashScreenBehavior' }, _: 'icon_preferred' }] }));
    splash.item = compatible;
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/values-v33/styles.xml');
    const existing = await XML.readXMLAsync({ path: target, fallback: '<resources></resources>' });
    const resources = existing.resources && typeof existing.resources === 'object' ? existing.resources : {};
    resources.style = [...(resources.style || []).filter(style => style.$.name !== qualified.$.name), qualified];
    await XML.writeXMLAsync({ path: target, xml: { resources } });
    return mod;
  });
};
