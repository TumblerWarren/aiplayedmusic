// Pastel Play: solid text surfaces, with decorative colour kept behind content.
export const palette = dark => ({
  bg: dark ? '#1D1B26' : '#FFFBF6', card: dark ? '#292635' : '#FFFFFF',
  ink: dark ? '#F7F1FF' : '#252331', muted: dark ? '#C0B8CD' : '#686273',
  line: dark ? '#3B354B' : '#EEE8F1', track: dark ? '#706582' : '#D6CCE6',
  accent: dark ? '#C4AEFF' : '#7353BB', onAccent: dark ? '#25183F' : '#FFFFFF',
  lavender: dark ? '#39304F' : '#EDE5FC', peach: dark ? '#4B3037' : '#FFE1D7',
  mint: dark ? '#243F3A' : '#DDF2E7', blue: dark ? '#293B54' : '#DFEAFE',
  lemon: dark ? '#423B29' : '#FFF0C2', rose: dark ? '#462D46' : '#F8E0F0',
  purpleInk: dark ? '#D8C6FF' : '#65439F', peachInk: dark ? '#FFC7B6' : '#984835',
  mintInk: dark ? '#A0DEC9' : '#256D5B', blueInk: dark ? '#B4D0FF' : '#355E9C',
  lemonInk: dark ? '#F5D98D' : '#795B16', roseInk: dark ? '#F1BCE0' : '#914C7C',
});

export const tones = c => [
  { bg: c.lavender, ink: c.purpleInk, pattern: 'arcs' },
  { bg: c.mint, ink: c.mintInk, pattern: 'checks' },
  { bg: c.peach, ink: c.peachInk, pattern: 'arcs' },
  { bg: c.lemon, ink: c.lemonInk, pattern: 'stripes' },
  { bg: c.blue, ink: c.blueInk, pattern: 'stripes' },
  { bg: c.rose, ink: c.roseInk, pattern: 'checks' },
];
