export type IdeaStatus =
  | 'new'
  | 'in-development'
  | 'idea'
  | 'dormant'
  | 'stale'
  | 'retired';

export interface Idea {
  title: string;
  href: string;
  desc: string;
  status: IdeaStatus;
  statusNote?: string;
  internal?: boolean;
  // Best-guess dates so ideas can sort into the chronological feed like
  // everything else — Hudson, please correct these to the real ones.
  date: string;
}

export const IDEAS: Idea[] = [
  {
    title: 'freezer martini calculator',
    href: '#freezer-martini',
    desc: 'Pick a ratio, dial in dilution, scale by any volume. For when you batch-prep and stash the bottle in the freezer.',
    status: 'new',
    internal: true,
    date: '2026-07-20',
  },
  {
    title: 'bicycle part picker',
    href: 'https://bicycle-part-picker.vercel.app/',
    desc: 'Plan your build, compare parts side-by-side. Think pcpartpicker, but for bikes.',
    status: 'in-development',
    date: '2025-11-01',
  },
  {
    title: 'gif cities keyboard',
    href: 'https://github.com/hudbud/gifcities-imessage',
    desc: "Get the good gifs on iMessage. A curated keyboard of the internet's best loops.",
    status: 'in-development',
    date: '2025-06-01',
  },
  {
    title: 'nice routes',
    href: '#',
    desc: 'Better navigation, community-based. Routes voted on by people who actually walked them.',
    status: 'in-development',
    date: '2025-03-01',
  },
  {
    title: 'queet',
    href: '#',
    desc: 'Ultra-minimal app for quitting stuff. Counts up how much money you\'re saving as you go.',
    status: 'in-development',
    date: '2024-12-01',
  },
  {
    title: 'weathr',
    href: '#',
    desc: 'Community-based, open-source weather reporting and predictions around San Francisco.',
    status: 'idea',
    date: '2024-06-01',
  },
  {
    title: 'musicshare',
    href: '#',
    // DRAFT — Hudson: placeholder, please replace with what this idea actually is.
    desc: 'A simple way to share what you’re listening to with friends.',
    status: 'idea',
    date: '2024-01-01',
  },
  {
    title: 'Cosmo Studio',
    href: 'https://cosmostud.io',
    desc: 'My web design business. Brands and sites built end-to-end — identity, system, shipped product.',
    status: 'dormant',
    date: '2022-01-01',
  },
  {
    title: 'Ugly Boys Running Club',
    href: 'https://uglyboysrunningclub.com/',
    desc: 'A blog, a TikTok, and a small line of custom clothing and hats. Run ugly, run often.',
    status: 'stale',
    statusNote: 'last posted 2 years ago',
    date: '2024-07-01',
  },
  {
    title: 'Locoll Design Co.',
    href: 'https://locoll.co',
    desc: 'Sticker and clothing brand. Small runs, hand-picked drops, mostly for friends.',
    status: 'retired',
    date: '2020-01-06',
  },
  {
    title: 'split keyboard',
    href: '#split-keyboard',
    desc: 'Custom ergonomic split mechanical keyboard — PCB layout, 3D-printed case, QMK firmware.',
    status: 'new',
    statusNote: 'completed',
    internal: true,
    date: '2019-06-01',
  },
];
