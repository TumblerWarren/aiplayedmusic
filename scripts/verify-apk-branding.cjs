const assert = require('node:assert/strict');
const fs = require('node:fs');

function resource(table, name) {
  const lines=table.split(/\r?\n/);
  const entries=lines.map((line,index)=>({line,index,match:line.match(/^\s*(?:spec\s+)?resource\s+(0x[\da-f]{8})\s+/i)})).filter(x=>x.match);
  const entry=entries.find(x=>x.line.includes(name) && new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\s|$)').test(x.line));
  assert(entry, `Missing packaged resource ${name}`);
  const next=entries.find(x=>x.index>entry.index);
  return { id:entry.match[1].toLowerCase(), body:lines.slice(entry.index,next?.index ?? lines.length).join('\n') };
}
function verifyBranding(launcher, table) {
  assert(/E:\s+adaptive-icon\b/.test(launcher),'The selected launcher must be adaptive');
  for (const node of ['background','foreground','monochrome']) assert(new RegExp('E:\\s+'+node+'\\b').test(launcher),`Missing launcher ${node}`);
  const referenced = node => {
    const match=launcher.match(new RegExp('E:\\s+'+node+'\\b[\\s\\S]*?=@(0x[\\da-f]{8})','i'));
    assert(match,`Missing drawable reference for ${node}`); return match[1].toLowerCase();
  };
  const foreground=resource(table,'drawable/aiplayed_launcher_foreground');
  const monochrome=resource(table,'drawable/aiplayed_launcher_monochrome');
  const logo=resource(table,'drawable/splashscreen_logo');
  const splash=resource(table,'style/Theme.App.SplashScreen');
  assert.equal(referenced('foreground'),foreground.id,'Launcher must use the branded foreground');
  assert.equal(referenced('monochrome'),monochrome.id,'Launcher must use the monochrome brand');
  assert(splash.body.includes('splashscreen_logo') || splash.body.toLowerCase().includes(logo.id),'Splash theme must reference the packaged logo');
  return {foreground:foreground.id,monochrome:monochrome.id,splashLogo:logo.id,splashTheme:splash.id};
}
function verifyCurrentUi(manifest, table) {
  assert(!/NativeMusicActivity|MusicNative(?:Dark)?Theme/.test(manifest + '\n' + table), 'APK contains the retired native interface');
  return true;
}
module.exports={verifyBranding,verifyCurrentUi};
if(require.main===module) {
  const table=fs.readFileSync(process.argv[3]||'apk-resource-table.txt','utf8');
  verifyCurrentUi(fs.readFileSync(process.argv[4]||'apk-manifest.txt','utf8'),table);
  console.log(JSON.stringify(verifyBranding(fs.readFileSync(process.argv[2]||'apk-launcher.txt','utf8'),table),null,2));
}
