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
}

export const IDEAS: Idea[] = [
  {
    title: 'freezer martini calculator',
    href: '/freezer-martini',
    desc: 'Pick a ratio, dial in dilution, scale by any volume. For when you batch-prep and stash the bottle in the freezer.',
    status: 'new',
    internal: true,
  },
  {
    title: 'bicycle part picker',
    href: 'https://bicycle-part-picker.vercel.app/',
    desc: 'Plan your build, compare parts side-by-side. Think pcpartpicker, but for bikes.',
    status: 'in-development',
  },
  {
    title: 'gif cities keyboard',
    href: 'https://github.com/hudbud/gifcities-imessage',
    desc: "Get the good gifs on iMessage. A curated keyboard of the internet's best loops.",
    status: 'in-development',
  },
  {
    title: 'nice routes',
    href: '#',
    desc: 'Better navigation, community-based. Routes voted on by people who actually walked them.',
    status: 'in-development',
  },
  {
    title: 'weathr',
    href: '#',
    desc: 'Community-based, open-source weather reporting and predictions around San Francisco.',
    status: 'idea',
  },
  {
    title: 'musicshare',
    href: '#',
    desc: '',
    status: 'idea',
  },
  {
    title: 'Cosmo Studio',
    href: 'https://cosmostud.io',
    desc: 'My web design business. Brands and sites built end-to-end — identity, system, shipped product.',
    status: 'dormant',
  },
  {
    title: 'Ugly Boys Running Club',
    href: 'https://uglyboysrunningclub.com/',
    desc: 'A blog, a TikTok, and a small line of custom clothing and hats. Run ugly, run often.',
    status: 'stale',
    statusNote: 'last posted 2 years ago',
  },
  {
    title: 'Locoll Design Co.',
    href: 'https://locoll.co',
    desc: 'Sticker and clothing brand. Small runs, hand-picked drops, mostly for friends.',
    status: 'retired',
  },
];
