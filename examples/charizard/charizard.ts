import type { HoloConfig } from '../../lib/holo.ts';

// Art: Charizard from the Celebrations Classic Collection (cel25c 4/A), a reprint of the
// Base Set card. Cut it out with `npm run cutout examples/charizard/card.json`.
export const charizard: HoloConfig = {
  title: 'charizard.exe',
  status: 'spits fire that is hot enough',
  icon: {
    pixels: [
      '................',
      '.......k........',
      '......kk........',
      '......kkk.......',
      '...k..kkkk......',
      '...kk.kkkkk..k..',
      '..kkk.kkrkk.kk..',
      '..kkkkkrrkkkkk..',
      '..kkkkrrrrkkkk..',
      '.kkkkrrrrrrkkkk.',
      '.kkkrrryyrrrkkk.',
      '.kkkrryyyyrrkkk.',
      '..kkrryyyyrrkk..',
      '..kkkrryyrrkkk..',
      '...kkkkkkkkkk...',
      '................',
    ],
    colors: { k: '#17100e', r: '#e02a14', y: '#ffb21c' },
  },
  palette: {
    face: '#f2c2b3', outer: '#f3e4de', light: '#fff4ee', shadow: '#b07f72', dark: '#5c3a34',
    title: ['#d90f0f', '#e0241c', '#ea7a66', '#ee907c'], titleText: '#ffffff', close: '#e1262a',
    ink: '#1b1210', iconWell: '#efe0da', iconEdge: '#8a6a64',
    wellEdge: '#8c6660', wellDark: '#3a2826', wellLight: '#ecd0c8',
    status: '#cfd6cf', statusEdge: '#8c7c78',
  },

  art: new URL('./art/charizard.png', import.meta.url).href,
  figure: { rect: [62, 150, 820], grade: { gamma: 1.85, tint: '#ffe69e' } },
  head: { pivot: [506, 597], centre: [246, 647], radii: [290, 205], still: [76, 827, 90, 190] }, // still: the tail
  backdrop: { centre: [478, 432], dark: '#541d08', light: '#a13e09' },
  breath: { mouth: [154, 625], angle: 180, colors: ['#f7e00a', '#ed5c08', '#170f08'] },
  ember: { at: [76, 853], size: [84, 138] },
};
