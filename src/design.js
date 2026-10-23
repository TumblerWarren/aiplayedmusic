// Pastel Play: solid text surfaces, with decorative colour kept behind content.
export const palette = dark => ({
  dark, bg: dark ? '#17191E' : '#FFFBF6', card: dark ? '#23262D' : '#FFFFFF',
  sheet: dark ? '#2D3039' : '#FFFBF6',
  ink: dark ? '#F4F2F7' : '#252331', muted: dark ? '#BBBCC8' : '#686273',
  line: dark ? '#3C414C' : '#EEE8F1', track: dark ? '#818799' : '#D6CCE6',
  controlBorder: dark ? '#818799' : '#7353BB',
  accent: dark ? '#C7B3F3' : '#7353BB', onAccent: dark ? '#17191E' : '#FFFFFF',
  lavender: dark ? '#302C40' : '#EDE5FC', peach: dark ? '#402C2B' : '#FFE1D7',
  mint: dark ? '#203A34' : '#DDF2E7', blue: dark ? '#29374A' : '#DFEAFE',
  lemon: dark ? '#3B3423' : '#FFF0C2', rose: dark ? '#3E2B3D' : '#F8E0F0',
  purpleInk: dark ? '#C7B3F3' : '#65439F', peachInk: dark ? '#E6AA99' : '#984835',
  mintInk: dark ? '#9DD3BC' : '#256D5B', blueInk: dark ? '#ABC5EB' : '#355E9C',
  lemonInk: dark ? '#F5D98D' : '#795B16', roseInk: dark ? '#F1BCE0' : '#914C7C',
  press: dark ? '#FFFFFF08' : '#7353BB18', scrim: dark ? '#00000099' : '#00000077',
  dialogScrim: dark ? '#00000099' : '#00000088', soundScrim: '#00000099',
  patternStrength: dark ? 0.4 : 1,
  knobArcs: dark ? ['#C7B3F3', '#9DD3BC', '#E6AA99'] : ['#BCA5E6', '#8ECDB7', '#F2B09D'],
  vinyl: dark ? '#111318' : '#30263F', groove: dark ? '#3C414C' : '#665473',
  spindle: dark ? '#DAD9E4' : '#FFFBF6', tonearm: dark ? '#A2A6B6' : '#C9B4EF',
  fallbackPalettes: dark ? [['#302C40', '#78669F', '#BE897B', '#6FA793'], ['#203A34', '#5C8D7C', '#859CC2', '#B49C61'], ['#402C2B', '#9D6C7E', '#9180B4', '#B89A54']]
    : [['#E9DFFC', '#A895D8', '#F5BCAC', '#83BAAA'], ['#DDF2E7', '#74AD9A', '#B6CEF0', '#F2CB83'], ['#FFE1D7', '#D797A8', '#C6B5EB', '#F0C56F']],
  startup: dark ? {
    shadow: '#000000', base: '#343940', rim: '#555C68', platter: '#252A31', led: '#9DD3BC',
    slot: '#737D8D', slider: '#555D6A', cap: '#DAD9E4', record: '#111318', groove: '#414753',
    label: '#7DAF9B', lavender: '#AD96D1', peach: '#CC9687', spindle: '#DAD9E4', pivot: '#8A75AF',
    arm: '#C4C6D1', needle: '#86BDA8', backdrop: '#292B3A', wave: '#20332E', waveLine: '#3C5B50',
    dot: '#B19ECA', blue: '#8FA8CF', cross: '#9B8DB7',
  } : {
    shadow: '#382847', base: '#F4CABB', rim: '#FFF5ED', platter: '#D8AEA3', led: '#438D7C',
    slot: '#BA8E88', slider: '#D4AAA4', cap: '#FFFBF6', record: '#30243F', groove: '#6B557D',
    label: '#A7D8C7', lavender: '#BCA5E6', peach: '#F2B09D', spindle: '#FFF8ED', pivot: '#B397DC',
    arm: '#FFFBF6', needle: '#79B5A3', backdrop: '#EEE5FC', wave: '#DDF2E7', waveLine: '#BBDDD0',
    dot: '#F2B09D', blue: '#9EB4DF', cross: '#AB93D2',
  },
});

export const tones = c => [
  { bg: c.lavender, ink: c.purpleInk, pattern: 'arcs' },
  { bg: c.mint, ink: c.mintInk, pattern: 'checks' },
  { bg: c.peach, ink: c.peachInk, pattern: 'arcs' },
  { bg: c.lemon, ink: c.lemonInk, pattern: 'stripes' },
  { bg: c.blue, ink: c.blueInk, pattern: 'stripes' },
  { bg: c.rose, ink: c.roseInk, pattern: 'checks' },
];
