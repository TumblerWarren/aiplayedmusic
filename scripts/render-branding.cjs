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
require('./render-launcher.cjs');
