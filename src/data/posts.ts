export interface Post {
  title: string;
  date: string;
  excerpt: string;
  html?: string;
  slug?: string;
  feature_image?: string;
  img?: string;
}

export const THOUGHTS_FALLBACK: Post[] = [
  { title: 'On the texture of tools', date: '03.14.2026', excerpt: 'A short note on why the best software feels like a well-made object. Weight, resistance, the way it pushes back when you push it.' },
  { title: 'Three kinds of slowness', date: '12.20.2025', excerpt: 'On the difference between slowness of pace, slowness of uptake, and slowness of effect. Which one are we actually asking for?' },
  { title: 'A grammar of interfaces', date: '11.04.2025', excerpt: 'Nouns, verbs, prepositions. What it means to treat UI as language rather than decoration.' },
  { title: 'The prototype is the spec', date: '01.05.2026', excerpt: "Why we've stopped writing requirements docs and started writing prototypes instead." },
  { title: 'Against the dashboard', date: '01.30.2026', excerpt: 'A polemic, lightly held. Why the dashboard-as-default is a failure of imagination.' },
];

export const LIFE_FALLBACK: Post[] = [
  { title: 'Field notes from a quiet week', date: '02.28.2026', excerpt: "Seven days without a to-do list. Observations on what fills the gap when structure goes missing — and what doesn't.", img: '#3a4a42' },
  { title: 'Letters from a borrowed desk', date: '01.18.2026', excerpt: 'Two weeks of working from someone else\'s studio. What a room remembers about its last occupant.', img: '#4a3a3e' },
  { title: 'Sourdough, month 18', date: '12.12.2025', excerpt: 'An 18-month log of the same starter. Photographs of every loaf on Sunday mornings.', img: '#4a453a' },
  { title: 'Marin, on foot', date: '11.03.2025', excerpt: 'Three days without a car or a plan, walking the headlands in the fog. A photo essay.', img: '#3a434e' },
  { title: 'Moving, again', date: '09.22.2025', excerpt: 'A small apartment, a smaller box of books. What I kept. What I finally let go.', img: '#3e3a4a' },
];
