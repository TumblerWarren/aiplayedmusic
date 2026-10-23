const path = require('node:path');
const { withAndroidStyles, XML } = require('expo/config-plugins');

// Register before expo-splash-screen: Expo executes style mods in reverse order.
module.exports = config => withAndroidStyles(config, async mod => {
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
