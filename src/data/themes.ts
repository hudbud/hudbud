export interface MonkeytypeTheme {
  name: string;
  bg: string;
  bgInner: string;
  fg: string;
  dim: string;
  accent: string;
}

export const MT_THEMES: MonkeytypeTheme[] = [
  { name: 'serika_dark', bg: '#323437', bgInner: '#2c2e31', fg: '#d1d0c5', dim: '#646669', accent: '#e2b714' },
  { name: 'serika', bg: '#e1e1e3', bgInner: '#eaeaec', fg: '#323437', dim: '#aaaeb3', accent: '#e2b714' },
  { name: 'bushido', bg: '#242933', bgInner: '#1e222a', fg: '#f6f0e9', dim: '#596172', accent: '#ec4c56' },
  { name: 'red_samurai', bg: '#84202c', bgInner: '#6e1a24', fg: '#e2dad0', dim: '#55131b', accent: '#c79e6e' },
  { name: 'metropolis', bg: '#0f1f2c', bgInner: '#0a1822', fg: '#e4edf1', dim: '#326984', accent: '#56c3b7' },
  { name: 'oblivion', bg: '#313231', bgInner: '#2a2b2a', fg: '#f7f5f1', dim: '#5d6263', accent: '#a5a096' },
  { name: 'magic_girl', bg: '#ffffff', bgInner: '#faf6f9', fg: '#00ac8c', dim: '#93e8d3', accent: '#f5b1cc' },
  { name: 'rgb', bg: '#111111', bgInner: '#0a0a0a', fg: '#eeeeee', dim: '#444444', accent: '#eeeeee' },
  { name: 'dracula', bg: '#282a36', bgInner: '#21222c', fg: '#f8f8f2', dim: '#6272a4', accent: '#bd93f9' },
  { name: 'nord', bg: '#242933', bgInner: '#1d212c', fg: '#d8dee9', dim: '#4c566a', accent: '#88c0d0' },
  { name: 'carbon', bg: '#313338', bgInner: '#292a2f', fg: '#f9f1c5', dim: '#606268', accent: '#f9f1c5' },
  { name: 'paper', bg: '#eeeeee', bgInner: '#f6f6f6', fg: '#444444', dim: '#aaaaaa', accent: '#444444' },
  { name: 'olivia', bg: '#1a1919', bgInner: '#141313', fg: '#f0e7d5', dim: '#4d483e', accent: '#ceb06d' },
  { name: 'terminal', bg: '#0f1010', bgInner: '#0a0b0b', fg: '#5eba7d', dim: '#2a3c31', accent: '#5eba7d' },
  { name: 'mizu', bg: '#6aaeca', bgInner: '#5ca0bc', fg: '#232323', dim: '#a6d4e4', accent: '#f7f6d5' },
  { name: 'strawberry', bg: '#f37b7b', bgInner: '#ea6f6f', fg: '#fffaeb', dim: '#ffd1b3', accent: '#fffaeb' },
];
