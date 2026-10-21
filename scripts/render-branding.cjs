const fs = require('node:fs');
const { harness } = require('./ui-harness.cjs');
const ui = harness('src/StartupArtwork.js', ['StartupArtwork'], { Svg:'svg', Circle:'circle', Path:'path', Rect:'rect', Animated:{View:'group'} });
const tree = ui.render('StartupArtwork',{size:400,rotation:'0deg'});
const escape = value => String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const render = node => {
  const attrs=Object.entries(node.props).filter(([key])=>!['key','style','accessible'].includes(key)).map(([key,value])=>`${key==='viewBox'?key:key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${escape(value)}"`).join(' ');
  return `<${node.type} ${attrs}>${node.children.map(render).join('')}</${node.type}>`;
};
const disc = tree.children[1].children[0];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">'+tree.children[0].children.map(render).join('')+'<svg x="36" y="76" width="248" height="248" viewBox="0 0 248 248">'+disc.children.map(render).join('')+'</svg>'+tree.children[2].children.map(render).join('')+'</svg>';
fs.writeFileSync('assets/startup-turntable.svg',svg+'\n');
const paths = [
  '<path android:fillColor="#7353BB" android:pathData="M54,21a33,33 0,1 0,0 66a33,33 0,1 0,0 -66"/>',
  '<group><clip-path android:pathData="M54,21a33,33 0,1 0,0 66a33,33 0,1 0,0 -66"/>',
  '<path android:fillColor="#F5AE98" android:pathData="M54,20C73,28 76,43 60,45C47,48 62,69 81,54L90,18Z"/>',
  '<path android:fillColor="#79B5A3" android:pathData="M90,42C71,48 81,64 60,64C41,63 44,79 54,90L90,90Z"/>',
  '<path android:fillColor="#98AFDF" android:pathData="M16,55C35,35 46,59 52,66C62,75 40,77 51,90H16Z"/></group>',
  ...[29,25,21].map(r=>`<path android:fillColor="#00000000" android:strokeColor="#40FFFFFF" android:strokeWidth="0.45" android:pathData="M54,${54-r}a${r},${r} 0,1 0,0 ${r*2}a${r},${r} 0,1 0,0 -${r*2}"/>`),
  '<path android:fillColor="#382442" android:pathData="M54,42a12,12 0,1 0,0 24a12,12 0,1 0,0 -24"/>',
  '<path android:fillColor="#FFFBF6" android:pathData="M51,48Q51,47 52,47.7L61,53.2Q62,54 61,54.8L52,60.3Q51,61 51,60Z"/>',
].join('\n');
const start='<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n';
const root='modules/local-music/android/src/main/res/';
fs.writeFileSync(root+'drawable/aiplayed_launcher_foreground.xml',start+paths+'\n</vector>\n');
fs.writeFileSync(root+'mipmap-anydpi/aiplayed_launcher.xml',start+'<path android:fillColor="#FFFBF6" android:pathData="M0,0H108V108H0Z"/>\n'+paths+'\n</vector>\n');
fs.writeFileSync(root+'values/launcher.xml','<resources><color name="aiplayed_launcher_background">#FFFBF6</color></resources>\n');
console.log('Rendered dedicated startup artwork and multicolour native launcher vectors.');
