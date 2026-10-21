const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('generated splash keeps Android 8 resources compatible and the complete Android 13 theme qualified', async () => {
  let transform, written;
  const plugins = {
    withAndroidManifest: config => config,
    withAndroidStyles: (config, callback) => { transform=callback; return config; },
    XML: { readXMLAsync: async () => ({ resources: { style: [{ $: { name:'OtherTheme' }, item:[] }] } }), writeXMLAsync: async options => { written=options; } },
  };
  const context={ module:{ exports:{} }, require: name => name==='node:path' ? path : plugins };
  vm.runInNewContext(fs.readFileSync('plugins/withSplashCompatibility.js','utf8'),context);
  context.module.exports({});
  const splash={ $:{ name:'Theme.App.SplashScreen',parent:'Theme.SplashScreen' },item:[
    { $:{name:'windowSplashScreenBackground'},_:'@color/splashscreen_background' },
    { $:{name:'windowSplashScreenAnimatedIcon'},_:'@drawable/splashscreen_logo' },
    { $:{name:'postSplashScreenTheme'},_:'@style/AppTheme' },
    { $:{name:'android:windowSplashScreenBehavior'},_:'icon_preferred' },
  ] };
  const mod={ modResults:{resources:{style:[splash]}},modRequest:{platformProjectRoot:'/tmp/test-android'} };
  await transform(mod);
  assert.equal(splash.item.length,3);
  assert(!splash.item.some(x=>x.$.name==='android:windowSplashScreenBehavior'));
  assert(written.path.endsWith('/res/values-v33/styles.xml'));
  const qualified=written.xml.resources.style.find(x=>x.$.name==='Theme.App.SplashScreen');
  assert.equal(qualified.$.parent,'Theme.SplashScreen');
  assert.equal(qualified.item.length,4);
  assert.equal(qualified.item.at(-1)._,'icon_preferred');
  assert(written.xml.resources.style.some(x=>x.$.name==='OtherTheme'));
  await transform(mod); assert.equal(written.xml.resources.style.filter(x=>x.$.name==='Theme.App.SplashScreen').length,1);
});


test('splash compatibility runs after Expo splash generation in the reverse mod stack', () => {
  const plugins=require('../app.config').expo.plugins.map(plugin=>Array.isArray(plugin)?plugin[0]:plugin);
  assert(plugins.indexOf('./plugins/withSplashCompatibility') < plugins.indexOf('expo-splash-screen'));
});

test('packaged branding follows resource references when APK paths are optimized', () => {
  const { verifyBranding }=require('./verify-apk-branding.cjs');
  const launcher=`E: adaptive-icon\n E: background\n A: drawable(0x01010199)=@0x7f05001b\n E: foreground\n A: drawable(0x01010199)=@0x7f070077\n E: monochrome\n A: drawable(0x01010199)=@0x7f070078`;
  const table=`Package name=app.localmusic.player id=7f\n resource 0x7f070077 drawable/aiplayed_launcher_foreground\n  () (file) res/aB.xml type=XML\n resource 0x7f070078 drawable/aiplayed_launcher_monochrome\n  () (file) res/cD.xml type=XML\n resource 0x7f070079 drawable/splashscreen_logo\n  (xhdpi) (file) res/eF.png type=PNG\n resource 0x7f130001 style/Theme.App.SplashScreen\n  () (style) size=3\n   windowSplashScreenAnimatedIcon(0x7f040001)=@0x7f070079`;
  assert.equal(verifyBranding(launcher,table).monochrome,'0x7f070078');
  assert.throws(()=>verifyBranding(launcher.replace('=@0x7f070077','=@0x7f070078'),table),/branded foreground/);
  assert.throws(()=>verifyBranding(launcher,table.replace('=@0x7f070079','=@0x7f070077')),/Splash theme/);
});
