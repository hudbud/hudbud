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
  /** Which home section this lands in; defaults to projects. */
  section?: 'projects' | 'work';
  // Best-guess dates so ideas can sort into the chronological feed like
  // everything else — Hudson, please correct these to the real ones.
  date: string;
}

export const IDEAS: Idea[] = [
  {
    title: 'freezer martini calculator',
    href: '#freezer-martini',
    desc: 'Pick a ratio, dial in dilution, scale by any volume. For when you batch-prep and stash the bottle in the freezer',
    status: 'new',
    internal: true,
    date: '2026-07-20',
  },
  {
    title: 'nice routes',
    href: '#',
    desc: 'Better navigation, community-based. Routes voted on by people who actually walked them',
    status: 'in-development',
    date: '2025-03-01',
  },
  {
    title: 'weathr',
    href: '#',
    desc: 'Community-based, open-source weather reporting and predictions around San Francisco',
    status: 'idea',
    date: '2024-06-01',
  },
  {
    title: 'musicshare',
    href: '#',
    // DRAFT — Hudson: placeholder, please replace with what this idea actually is.
    desc: 'A simple way to share what you’re listening to with friends',
    status: 'idea',
    date: '2024-01-01',
  },
  {
    title: 'Cosmo Studio',
    href: 'https://cosmostud.io',
    desc: 'My web design agency. I build and run brands and sites end-to-end — identity, system, shipped product',
    status: 'dormant',
    statusNote: 'web design',
    section: 'work',
    date: '2022-01-01',
  },
  {
    title: 'split keyboard',
    href: '#split-keyboard',
    desc: 'Custom ergonomic split mechanical keyboard — PCB layout, 3D-printed case, QMK firmware',
    status: 'new',
    statusNote: 'completed',
    internal: true,
    date: '2019-06-01',
  },
];
