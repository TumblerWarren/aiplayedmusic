const fs = require('node:fs');
const { harness, palette } = require('./ui-harness.cjs');
const ui = harness('src/StartupArtwork.js', ['StartupArtwork'], { Svg:'svg', Circle:'circle', Path:'path', Rect:'rect', Animated:{View:'group'} });

const escape = value => String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const render = node => {
  const attrs=Object.entries(node.props).filter(([key])=>!['key','style','accessible'].includes(key)).map(([key,value])=>`${key==='viewBox'?key:key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${escape(value)}"`).join(' ');
  return `<${node.type} ${attrs}>${node.children.map(render).join('')}</${node.type}>`;
};
for (const dark of [false, true]) {
const tree = ui.render('StartupArtwork',{size:400,rotation:'0deg',c:palette(dark)});
const disc = tree.children[1].children[0];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">'+tree.children[0].children.map(render).join('')+'<svg x="36" y="76" width="248" height="248" viewBox="0 0 248 248">'+disc.children.map(render).join('')+'</svg>'+tree.children[2].children.map(render).join('')+'</svg>';
fs.writeFileSync(`assets/startup-turntable${dark ? '-dark' : ''}.svg`,svg+'\n');
}
// One beamed music-note silhouette for standard, adaptive and themed launchers.
const musicNote = 'M51,47.7L59,45.9Q60,45.6 60,46.8V58.4C60,60.3 58.4,61.7 56.7,61.7C55.2,61.7 54.5,60.7 54.9,59.5C55.3,58.1 56.9,57.2 58.2,57.6V50.6L52,52V60.3C52,62.2 50.4,63.6 48.7,63.6C47.2,63.6 46.5,62.6 46.9,61.4C47.3,60 48.9,59.1 50.2,59.5V48.8Q50.2,47.9 51,47.7Z';
const paths = [
  '<path android:fillColor="#7353BB" android:pathData="M54,21a33,33 0,1 0,0 66a33,33 0,1 0,0 -66"/>',
  '<group><clip-path android:pathData="M54,21a33,33 0,1 0,0 66a33,33 0,1 0,0 -66"/>',
  '<path android:fillColor="#F5AE98" android:pathData="M54,20C73,28 76,43 60,45C47,48 62,69 81,54L90,18Z"/>',
  '<path android:fillColor="#79B5A3" android:pathData="M90,42C71,48 81,64 60,64C41,63 44,79 54,90L90,90Z"/>',
  '<path android:fillColor="#98AFDF" android:pathData="M16,55C35,35 46,59 52,66C62,75 40,77 51,90H16Z"/></group>',
  ...[29,25,21].map(r=>`<path android:fillColor="#00000000" android:strokeColor="#40FFFFFF" android:strokeWidth="0.45" android:pathData="M54,${54-r}a${r},${r} 0,1 0,0 ${r*2}a${r},${r} 0,1 0,0 -${r*2}"/>`),
  '<path android:fillColor="#382442" android:pathData="M54,42a12,12 0,1 0,0 24a12,12 0,1 0,0 -24"/>',
  `<path android:fillColor="#FFFBF6" android:pathData="${musicNote}"/>`,
].join('\n');
const start='<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n';
const root='modules/local-music/android/src/main/res/';
fs.writeFileSync(root+'drawable/aiplayed_launcher_foreground.xml',start+paths+'\n</vector>\n');
fs.writeFileSync(root+'mipmap-anydpi/aiplayed_launcher.xml',start+'<path android:fillColor="#FFFBF6" android:pathData="M0,0H108V108H0Z"/>\n'+paths+'\n</vector>\n');
fs.writeFileSync(root+'drawable/aiplayed_launcher_monochrome.xml',start+`<path android:fillColor="#FFFFFF" android:fillType="evenOdd" android:pathData="M54,21a33,33 0,1 0,0 66a33,33 0,1 0,0 -66${musicNote}"/>\n</vector>\n`);
fs.writeFileSync(root+'values/launcher.xml','<resources><color name="aiplayed_launcher_background">#FFFBF6</color></resources>\n');
console.log('Rendered dedicated startup artwork and multicolour native launcher vectors.');
