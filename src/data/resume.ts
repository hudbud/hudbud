export interface ResumeEntry {
  years: string;
  role: string;
  org: string;
}

export const RESUME: ResumeEntry[] = [
  { years: '2025 —', role: 'Design Lead', org: 'Lightsource' },
  { years: '2022 — 2025', role: 'Senior Product Designer, Design Systems', org: 'Carvana' },
  { years: '2021 — 2022', role: 'Visual Designer', org: 'Hathway' },
  { years: '2020 — 2021', role: 'Lead Product Designer', org: 'Botstacks' },
  { years: '2020', role: 'Web & Multimedia Specialist', org: 'SureClinical' },
  { years: '2018', role: 'Product Designer, AR', org: 'ODG' },
  { years: '2015 — 2023', role: 'Freelance Designer', org: 'LoColl Design Co' },
  { years: 'B.S.', role: 'Liberal Arts & Engineering Studies', org: 'Cal Poly SLO' },
];

export interface ResumeLink {
  label: string;
  href: string;
}

export const LINKS: ResumeLink[] = [
  { label: 'email', href: 'mailto:hudbud@gmail.com' },
  { label: 'photos', href: 'https://hudbud.net' },
  { label: 'studio', href: 'https://cosmostud.io' },
  { label: 'resume', href: 'https://drive.google.com/uc?export=download&id=12XqXfrcCHy-cvV-HCnX75iahV_n5QDSg' },
];

export const SELECT_CLIENTS: string[] = [
  'Carvana',
  "Dave & Buster's",
  'Red Robin',
  'QDOBA',
  'Dutch Bros',
  "Denny's",
  'Blaze Pizza',
  'Panda Express',
  "Arby's",
  'Pieology',
];
