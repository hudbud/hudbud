export interface Tile {
  id: string;
  title: string;
  kind: string;
  year: string;
  medium: string;
  caption: string;
  color: string;
  href?: string;
  image?: string;
}

export const TILES: Tile[] = [
  { id: 't01', title: 'CarvanaDS', kind: 'design-system', year: '2022 — present', medium: 'Design system + website', caption: 'UI, design ops, engineering, icons, maintenance.', color: '#3a434e' },
  { id: 't02', title: "Dave & Buster's", kind: 'product', year: '2022', medium: 'App + web app', caption: 'Product design, motion graphics, 3D, design systems.', color: '#4a3a3e', href: 'https://www.daveandbusters.com/us/en/rewards' },
  { id: 't03', title: 'Red Robin', kind: 'product', year: '2021', medium: 'Ordering app + site', caption: 'Product design and design systems for the ordering flow.', color: '#3a4a42', href: 'https://www.redrobin.com/order' },
  { id: 't04', title: 'QDOBA', kind: 'brand', year: '2021', medium: 'Identity + web + app', caption: 'Brand identity, web design, ordering app and website.', color: '#4a453a' },
  { id: 't05', title: 'Pieology', kind: 'product', year: '2021', medium: 'Ordering app', caption: 'UI design, icon design, design systems.', color: '#3e3a4a', href: 'https://order.pieology.com/order/openMap' },
  { id: 't06', title: 'Dutch Bros Rewards', kind: 'product', year: '2021', medium: 'UI + 3D + email', caption: 'UI design, email design, 3D and motion, web design.', color: '#4a423a', href: 'https://www.dutchbros.com/rewards' },
  { id: 't07', title: "Denny's", kind: 'web', year: '2021', medium: 'Website + ordering', caption: 'UI design, web design, design systems, graphic design.', color: '#3a4a4a', href: 'https://www.dennys.com/' },
  { id: 't08', title: 'Blaze Pizza', kind: 'product', year: '2021', medium: 'App + web + CRM', caption: 'UI design, product design, design systems, CRM design.', color: '#4a3a45', href: 'https://www.blazepizza.com/' },
  { id: 't09', title: 'Panda Express', kind: 'motion', year: '2021', medium: 'Motion design', caption: 'Motion design for the online ordering experience.', color: '#3a444a', href: 'https://www.pandaexpress.com/' },
  { id: 't10', title: "Arby's", kind: 'motion', year: '2020', medium: 'Motion design', caption: 'Motion design work for digital ordering.', color: '#443a4a' },
  { id: 't11', title: 'ODG AR interfaces', kind: 'ar', year: '2018', medium: 'AR headset UI', caption: 'Product design for augmented reality hardware.', color: '#4a4a3a' },
  { id: 't12', title: 'Botstacks', kind: 'product', year: '2018 — 2021', medium: 'Conversational platform', caption: 'Lead product design for a chatbot-building platform.', color: '#3a4a3e' },
];
