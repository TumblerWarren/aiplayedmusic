// Approved concept 3: flowing purple/coral play ribbons on warm ivory.
// Shared paths keep standard, adaptive, themed and Expo icons consistent.
const fs = require('node:fs');
const ribbons = [
  ['#35106F', '#8742F4', 'M31,27C31,20 37,18 43,22L78,43C87,48 87,56 79,58C67,60 55,47 44,41C38,37 34,36 31,43Z'],
  ['#FF726E', '#FFC3A4', 'M31,51C31,43 36,39 42,41C54,44 65,57 79,56C82,56 85,53 86,50C85,61 76,67 66,66C54,65 44,55 38,55C35,55 33,57 31,61Z'],
  ['#34106B', '#8040EA', 'M31,70C31,62 36,58 42,61C55,70 68,72 81,62C72,73 57,80 43,88C37,92 31,89 31,82Z'],
];
const root = 'modules/local-music/android/src/main/res/';
const group = 'android:scaleX="0.82" android:scaleY="0.82" android:translateX="9.72" android:translateY="9.72"';
const start = '<vector xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n';
const paths = ribbons.map(([start, end, path]) => `<path android:pathData="${path}"><aapt:attr name="android:fillColor"><gradient android:type="linear" android:startX="31" android:startY="65" android:endX="82" android:endY="31" android:startColor="${start}" android:endColor="${end}"/></aapt:attr></path>`).join('\n');
fs.writeFileSync(root+'drawable/aiplayed_launcher_foreground.xml', start+`<group ${group}>\n${paths}\n</group>\n</vector>\n`);
fs.writeFileSync(root+'mipmap-anydpi/aiplayed_launcher.xml', start+'<path android:fillColor="#FFFBF6" android:pathData="M0,0H108V108H0Z"/>\n'+`<group ${group}>\n${paths}\n</group>\n</vector>\n`);
fs.writeFileSync(root+'drawable/aiplayed_launcher_monochrome.xml', start+`<group ${group}><path android:fillColor="#FFFFFF" android:pathData="${ribbons.map(r=>r[2]).join(' ')}"/></group>\n</vector>\n`);
fs.writeFileSync(root+'values/launcher.xml','<resources><color name="aiplayed_launcher_background">#FFFBF6</color></resources>\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 108 108"><defs>${ribbons.map(([start,end],i)=>`<linearGradient id="r${i}" gradientUnits="userSpaceOnUse" x1="31" y1="65" x2="82" y2="31"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`).join('')}</defs><path fill="#FFFBF6" d="M0 0H108V108H0Z"/><g transform="translate(9.72 9.72) scale(.82)">${ribbons.map((r,i)=>`<path fill="url(#r${i})" d="${r[2]}"/>`).join('')}</g></svg>`;
fs.writeFileSync('assets/aiplayed-icon.svg', svg+'\n');
console.log('Rendered concept 3 launcher SVG and native vectors.');
