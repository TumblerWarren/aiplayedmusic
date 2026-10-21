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
  vm.runInNewContext(fs.readFileSync('plugins/withMusic.js','utf8'),context);
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
