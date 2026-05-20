/**
 * Scrape Squarespace portfolio projects — download images and create markdown posts.
 *
 * Downloads images from the Squarespace CDN and generates archive markdown files
 * for portfolio projects that were not covered by the XML-based migration.
 *
 * Usage:
 *   npx tsx scripts/scrape-squarespace.ts
 *
 * Requirements:
 *   - Node 18+ (uses native fetch)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/content/posts');
const PUBLIC_POSTS = path.join(ROOT, 'public/posts');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  slug: string;
  dirId: number;
  title: string;
  date: string;
  excerpt: string;
  roles: string[];
  tools: string[];
  agency?: string;
  images: string[];
}

// ---------------------------------------------------------------------------
// Project Data
// ---------------------------------------------------------------------------

const projects: Project[] = [
  {
    slug: 'dave-and-busters',
    dirId: 47,
    title: "Dave and Buster's",
    date: '2021-10-06',
    excerpt: "Design systems, UI design, 3D reward illustrations for Dave & Buster's loyalty and ordering experience at Hathway.",
    roles: ['Design Systems Manager', 'UI Designer', 'UX Support', 'Motion Graphics', '3D Specialist'],
    tools: ['Figma', 'After Effects', 'Blender', 'Illustrator'],
    agency: 'Hathway',
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633553096812-D9KSID2SWF6V5AH4J6PA/Slide+16_9+-+1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633553212363-2QGU8MKMRD4DRTCYU58T/MAIN.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/59d08e7f-880c-45bb-a516-eb2d11e46bdf/dingdingding-7.png',
    ],
  },
  {
    slug: 'red-robin',
    dirId: 48,
    title: 'Red Robin',
    date: '2021-10-06',
    excerpt: "Mobile ordering app and design systems for Red Robin's digital ordering experience at Hathway.",
    roles: ['UI Design', 'Design Systems Management'],
    tools: ['Figma', 'Photoshop'],
    agency: 'Hathway',
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633561940362-XYOOEQIGOMJJDT5D1WV0/Slide+16_9+-+1.png',
    ],
  },
  {
    slug: 'pieology',
    dirId: 49,
    title: 'Pieology',
    date: '2021-10-05',
    excerpt: 'Ordering and loyalty app with hand-drawn iconography for Pieology pizza chain at Hathway.',
    roles: ['UI Support', 'UI Toolkit Support', 'Hand-drawn Iconography'],
    tools: ['Sketch', 'Illustrator', 'Procreate', 'Figma'],
    agency: 'Hathway',
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477401732-5M18FVMKEC5TJWSMF179/Vectary+texture-1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477345368-8Z9EAPVB6TV18RT3R87R/Artboard+149%404x.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477462151-SCNBRUGYLE8UK5CKGSNJ/Vectary+texture.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477498174-U0BCF5LQPYLDK310Y3GW/Screen+Shot+2021-10-05+at+4.15+1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477383920-2YDVTKXHCJPAZR1JIWBA/Vectary+texture-2.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477710488-QG11UE8ISYI0WVP3TA4T/Frame+4.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477774673-CHW40WNW0NYPJOR2Q82I/speef_1.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633478469579-1AOIYBV7EA7KWSNT4WOS/Frame+5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633477548896-Q0YQZ3QSHCUVURCYT0HG/image+3.png',
    ],
  },
  {
    slug: 'dutch-bros',
    dirId: 50,
    title: 'Dutch Bros Coffee',
    date: '2022-01-24',
    excerpt: 'Design systems management, Sketch-to-Figma conversion, and UI support for Dutch Bros loyalty app at Hathway.',
    roles: ['Design Systems Management', 'UI Support', 'Graphic Design'],
    tools: ['Figma', 'Sketch', 'Photoshop', 'Illustrator'],
    agency: 'Hathway',
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554020863-69S8CWQKUS5M2QE4Q1UQ/Slide+16_9+-+1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554076124-YED4YXQPWLWHKNOROYEE/Frame+229.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554128773-NZJ0RPDW94JOMBX8ILIC/Frame+230.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554166520-RO04QIXQ62EZCBDFBBS8/Color+Palette.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554165867-I89WA35S301ZM56PU35Z/Typography.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554166945-FEJMEHSPGGUBHLYQ2Q8B/Atoms.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554167390-3WAGZ75Z46A341AJP29O/Molecules.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633554168368-JENTX8KCRN4EN6554RDK/Organisms.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/ffdb8b62-4151-4090-bc0a-24465b95c575/MAIN.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1643046218070-MFTREUK2XR4TV2PKKKDV/slice1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1643046218591-R1T1E2L3WLYAQKX6W2SP/slice2.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1643046221472-9CACRDIQBAUM9T6EXXRM/slice3.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1643046222037-FF9NGVNSSYS85DL9N4F/slice4.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1643046224064-9QLTE3XC4CH7XZNJPID6/slice5.png',
    ],
  },
  {
    slug: 'dennys',
    dirId: 51,
    title: "Denny's",
    date: '2021-10-06',
    excerpt: "Design system management and UI screens for Denny's mobile and desktop ordering platforms at Hathway.",
    roles: ['UI Design', 'UI Toolkit Support'],
    tools: ['Figma', 'Illustrator'],
    agency: 'Hathway',
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633551008107-16ZLFVSPAJ2XBNY6DJLJ/Slide+16_9+-+1.png',
    ],
  },
  {
    slug: 'blaze',
    dirId: 52,
    title: 'Blaze Pizza',
    date: '2021-10-06',
    excerpt: "Visual refresh, UI design, and art direction for Blaze Pizza's ordering and loyalty experience at Hathway.",
    roles: ['UI Design', 'UI Toolkit Management', 'Art Direction', 'Figma Conversion'],
    tools: ['Sketch', 'Figma', 'Illustrator', 'Photoshop'],
    agency: 'Hathway',
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542378785-UQD2IWJL5WHEVXEG1YX5/image+13.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542454299-TIRRRJR86GNFGTO9U1BD/Frame+5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542452087-EF7WECES5WUXRYA0AZP9/Frame+2.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542534313-W5H1GOCXWI5TTI1HHJCA/Frame+1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542456650-2I30H221XDTKGRIBNYX3/Frame+3.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542674088-CITXRI0KJL29WRCGT2GZ/Frame+4.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542678726-5X3MGTFDIE2JFMW8KJ4T/Frame+6.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542689791-82T8Y4KVC3WBSQGRMT9N/Frame+7.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542692982-757GVJ8HABQ7Y4H0OALO/Frame+8.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542693685-RM9DSW40JRHCWONHJJNG/Frame+9.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542696245-RVFL4GY0AM6DWIP5L6PZ/Frame+10.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542707174-P6K3NCUPE7CB4PMYJP9Y/Frame+11.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542712322-3VOH9OCJSO0LTM4G8WXY/Frame+12.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542716250-PGTFESLDOPINBUCGSLFH/Frame+13.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542719861-9MHJ3T2Q7AQKJAMM0DN/Frame+14.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542727508-QPWPX6AG227UVFWNS5T8/Frame+15.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633542757533-MFT3K7256X95MRUW8GK7/image+13.png',
    ],
  },
  {
    slug: 'arbys',
    dirId: 53,
    title: "Arby's",
    date: '2021-10-06',
    excerpt: "Animated videos for Arby's franchisee conference at Hathway.",
    roles: ['Animator'],
    tools: ['After Effects', 'Illustrator'],
    agency: 'Hathway',
    images: [],
  },
  {
    slug: 'pandaexpress',
    dirId: 54,
    title: 'Panda Express',
    date: '2021-10-06',
    excerpt: 'Animation and UI support for Panda Express ordering experience at Hathway.',
    roles: ['Animation', 'UI Support'],
    tools: ['After Effects', 'Sketch', 'Lottie', 'Illustrator'],
    agency: 'Hathway',
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1633552773473-4J2WFL1J3KL345BC5KD6/Frame+2.png',
    ],
  },
  {
    slug: 'zib',
    dirId: 55,
    title: 'Zib Messenger',
    date: '2021-03-10',
    excerpt: 'Lead product design for Zib — a Slack-competitor messaging app with 3D workspace environments. Branding, UX/UI, web design.',
    roles: ['Product Design (Lead)', 'Branding', '3D Graphics', 'UX/UI Design', 'Web Design'],
    tools: ['Figma', 'Blender', 'Unity'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345253648-LU2T95NC9NR35WKX6GZQ/Website+-+Signed+Out.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615348471547-G4E4HE6N2EL6UZXW4060/mainlogo.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615348487212-FFPK3CL70ID9IPA4UHKV/palette.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615348515805-9Z28C3STSGFY6F0W8Q1Q/portfolio-1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615348532789-I0BYAR1BF5PLHRKS3N5U/portfolio-2.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345557075-RQWBC12JFGTIILEI7IMR/Template.jpg',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345576738-VGFPPVETP7GBBWIMB62H/Threads.jpg',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347388618-DLBPVNA29OKFL2NJQ9KU/Settings+Home.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347388429-9AF2A73ZUG4OZUKMO8DU/Settings+Home+-+Nav.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347387751-2G14873717V29816JPSB/Floor+Plans.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347388004-WRCBDJ0GBHWQPPMLU5AJ/Permissions.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347387462-T6QBEY7NSG6FG0FP3BXA/Manage+Members.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347386358-9YN31SH3T3GXF60SFDT3/Channels.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347389059-4XTREH2GUDI34NH49PNC/Settings.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615347386245-5O7BEXJV3W8YK78HMQ/About+Workspace.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345850956-3B30753D0IZBR8YP99YB/Frame+2.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345850790-Q712B9WR7JO0SMPZ7P5R/Frame+3.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345853736-SSE1ENL2SWLKM191XV60/Frame+4.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345853657-KASX0ED09DJZDGAW1MAQ/Frame+5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345857022-044ALCUEU1RQQVDGYTFP/Frame+6.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345855893-9AO9QXKLKW1B777E3FOF/Frame+7.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345857970-NJDBOVZV299ZMXR7V0L6/Frame+8.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345858885-BNJC8KIFEAFXSF254MO9/Frame+15.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345859861-IPP2M1GFPSTAGGJYNRU7/Frame+16.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345860925-S56MF23RUAO73DLKV28Q/Frame+17.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345689033-EC41VQF4SSZR0OSQNGL2/Frame+10.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345690201-WC5IVFDY8IO6CN65JZU7/Frame+11.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345692677-7XJBRRZBAJZWH1CKZLX9/Frame+12.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615345692857-6KSQIIHYE1AYNXB0YXLK/Frame+13.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615346861940-8RCQK6CGGT70BTI1JKBG/Frame+18.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615346373228-Z6ULDPCIVI1DFZ1C0D11/render3-1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615346796557-6G49XYF4CLJ8S7FI0MUL/dotsrender1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615346460472-G8BA30Z7GKZC33CVYYWX/render6.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615346685139-NG1643N4L8HLYOGMITZA/newmodels1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615356260665-9QBWTDM09WI5820KIWK6/unityscreenshot.png',
    ],
  },
  {
    slug: 'inappchat',
    dirId: 56,
    title: 'In-App Chat',
    date: '2021-03-10',
    excerpt: 'UX/UI design, web design, and motion graphics for a messaging SDK WebApp.',
    roles: ['UX/UI Design', 'Web Design', 'Motion Graphics'],
    tools: ['Figma'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615353471827-MU8F4CIRT33LYE40GJA4/main.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615353446061-1RUHK35OFB83YC8DRE28/main1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615349847591-BF0AGUQ5YL0B15YVS0QY/Screenshot+2021-03-09+201704.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1615349723142-EKOO8PNN2ETO8IXYYQMN/features.jpg',
    ],
  },
  {
    slug: 'odg',
    dirId: 57,
    title: 'Osterhout Design Group',
    date: '2020-10-02',
    excerpt: 'Branding, marketing, UI/UX, and web design for next-generation AR hardware company.',
    roles: ['Branding', 'Marketing', 'UI/UX', 'Web Design'],
    tools: ['Figma', 'After Effects', 'Illustrator'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1601664494349-SAHLJ61DBMA5WUANG7XZ/banner.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1601663393473-WH5TEYIB2EARDB27O149/ui_gallery.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1601663326095-TZ6BW7NTN3OC176QIGTI/magazine.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1601663304842-D8VNM0OWC2TUDH0RWRT7/musicplayer.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1601663352499-FXLCFS85SMX11BLRHNDV/scrollimages.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1601663387551-IW0CT41UEY038SYB87N1/ui_scrollvertically.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1601939976932-1MTM31T6HPOJ3U9077TY/odg_icons.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599085663046-FM97Z1SGXZYW681DEH1A/YouTube+-+Banner.png',
    ],
  },
  {
    slug: 'pellowski',
    dirId: 58,
    title: 'TheBigPellowski',
    date: '2020-09-02',
    excerpt: 'Twitch streamer branding — animated intros, stream overlays, motion graphics, and Streamlabs deployment.',
    roles: ['Branding', 'Motion Graphics', 'Streamlabs Deployment'],
    tools: ['After Effects', 'Illustrator', 'Streamlabs'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599086612092-9T0YNST68LK69AMREI5W/2020_09_02_15_34_45.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599087495168-PPGVXTHLHYRF40PBLCSV/YT_intro_main_1.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599086864304-ZZM83RBNR95H5R705V0U/streamstartingsoon.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599086863285-FMJGKI9FVQ7U2II30N6U/mainlogoscene.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599086820779-NWV51FH5OG7XVBPNY2V1/brb.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599086863381-W97EOW9AV9ANWX3TC2QR/streamover.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599087400562-08O5TEF61M2CRFS2V94F/yt_outro.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599088428216-S0JT4UG0W254DGL1WZ22/Annotation+2020-09-02+161326.png',
    ],
  },
  {
    slug: 'buildform',
    dirId: 59,
    title: 'BuildForm',
    date: '2020-09-04',
    excerpt: 'Logo and branding concepts for a custom home building company.',
    roles: ['Branding', 'Logo Design'],
    tools: ['Illustrator', 'Figma'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260498000-K0AX244INUSBY32Q69SC/logo.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260533746-FPAYMRFVZRDXASPX7G5K/2.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260586799-N40D3GOQ6Z7P6A7VD753/4.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260617150-CGHBO5XPVUJZ2TDSUI65/buildform_rd1_delivery_3.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260649414-1POGWPBMCYR2Q5CUHX96/3.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260803624-9TK5XZ8WTZXH80SHVXW8/3.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260804846-LSFHVBU54ERXVIV7X77G/4.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260804486-YJ6C7HI84R7RMQ7YQ44D/5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260824294-B5FZO8KP3SZCN0F3VO5O/6.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260808921-JTTHVQ5Q2RILAI43BRYB/11.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260816769-JGLLZNHRDIIJQOB82GB3/13.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260811511-9ZKUY2J725PZE0VTM1BO/12.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599260838896-Z1FCXKUQAE3H6QMHH9CD/14.png',
    ],
  },
  {
    slug: 'savasana-sound',
    dirId: 60,
    title: 'Savasana Sound',
    date: '2021-03-04',
    excerpt: 'Branding and logo design for a sound bath performance group.',
    roles: ['Branding', 'Logo Design'],
    tools: ['Illustrator', 'Figma'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903038885-E8GJL5UL4HMXLH0Y2K8H/1.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903039033-RSDE851SA50U22H4Y9WX/2.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903041021-T171YY20UO5X89M7EZ5H/3.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903040156-H9TK1TBMSU4XFYAAACC2/3.5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903041211-6N2AAIXQH56ABK64MFI5/4.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903042002-PBVW1GJ2Q8FXASE5T34I/4a.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903044365-DABUCQT6HVJNHOPIPX6S/8.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903044038-1G4R2UKB0PC9QUVDC1ZI/8.5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903042193-W940RK3HA0KAQDFWSZTX/5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903042827-7VLFCSW7W5RAOP9FN3OR/5a.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903044882-5Z9YBVEK2PZATGJ1T4RO/9.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903045187-QAJAV2Z2RKJO0VNB/10.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903047961-7HF9YYUGA1C5GFI5YW2/13.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903048394-XDTHRVUWBM19ZUMT2REA/13.5.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903049822-IXU5EQ43T999LHS3C1ZX/14.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903050259-WEYHZH6KIHA17PL0IMV4/15.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903050963-787UWHNOB9F80DIYYRC2/18.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903053211-RAOTCPMSK4SNFZIJBEH7/20.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903051954-L4UKKMX2TEA4ARFSZ0YR/21.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614903152445-FUHHSM2KFZGQ62FKJS82/Artboard+1.png',
    ],
  },
  {
    slug: 'pantepic',
    dirId: 61,
    title: 'Pantepic',
    date: '2020-09-04',
    excerpt: 'Logo, branding, UI design, and mapbox design for a map-based secure messenger. Successfully launched on iOS and Android.',
    roles: ['Logo & Branding', 'UI Design', 'Mapbox Design', 'Marketing Collateral', 'Web Design', 'Sticker Design'],
    tools: ['Figma', 'Illustrator', 'Mapbox'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599252340711-AA7Y1SJ496UTAU4WKEIO/Stationery+Mockup+-+Free+Version.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1597874254008-68L9RDIKFXWATPE8U29Z/PANTEPIC-LOGO.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599259543906-0QCA6JF4IZDLWQWMHIQD/final.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599252723198-OZ4LC5QT1BVROI6LMZ3S/pantepic_logo_guidelines.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1597874393455-DHQN6DH6NXUUB54VS5R2/Annotation+2020-08-19+142915.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599252879504-JH0MTT2Q02PWNSZG509Y/pantepic+scheduled.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599252887461-97RAPAKF79711ETQ5JER/scheduled.jpg',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599252890394-WMHKJ50BBW1NVKFTBJB8/selfdestruct.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599252900080-JJ8E054STO4Q64OI2C8Q/SOS.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1599085262077-42DZM5L8LLGAL7QWXVB0/banner.png',
    ],
  },
  {
    slug: 'tunein',
    dirId: 62,
    title: 'TuneIn',
    date: '2020-06-09',
    excerpt: 'Brand design and style guide for a silent disco application.',
    roles: ['Brand Design', 'Style Guide'],
    tools: ['Illustrator', 'Figma'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1591737778375-I3P0N0ZPPC08EA7ZERXK/Mockup.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1591738944014-VZN28PNHH9LMT2TXXZ14/styleguide1.jpg',
    ],
  },
  {
    slug: 'ugly-boys',
    dirId: 63,
    title: 'Ugly Boys Running Club',
    date: '2020-08-28',
    excerpt: 'Running club branding and merchandise. TikTok exceeding 60,000 views, Giphy exceeding 758,818 views.',
    roles: ['Branding', 'Merchandise Design', 'Screen Printing'],
    tools: ['Illustrator', 'After Effects'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1598633526604-D5HLOS4C9D9H01T3R6YD/uglyboysrunningclub.gif',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1598635372518-LPG1ZN0BSTY2QL2DSY36/front.jpg',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1598635384212-HIB9LUE6KZH2LKD2OYVG/back.jpg',
    ],
  },
  {
    slug: 'trew-gear',
    dirId: 64,
    title: 'Trew Gear',
    date: '2021-03-23',
    excerpt: 'Single page web design for outdoor gear company.',
    roles: ['Web Design'],
    tools: ['Figma'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1616484421610-CF055ZRF6YDERNSYXKC6/TREW_TECHNOLOGY_PNW3L_GRID.png',
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1616483775384-NYCX1I4SYN7H3M6JNTZK/mock_4.gif',
    ],
  },
  {
    slug: 'papercut-films',
    dirId: 65,
    title: 'Papercut Films',
    date: '2021-03-04',
    excerpt: 'Logo and branding for a film production company.',
    roles: ['Branding', 'Logo Design'],
    tools: ['Illustrator'],
    images: [
      'https://images.squarespace-cdn.com/content/v1/5deb51867c131a3015f10a6c/1614904644389-R0XBQYVWM223C0V6499D/PAPERCUT_LOGO_REV1.png',
    ],
  },
  {
    slug: 'country-gentlemen',
    dirId: 66,
    title: 'The Country Gentlemen',
    date: '2020-09-04',
    excerpt: 'Logo design and branding for a Chicago-based improv group.',
    roles: ['Logo Design', 'Branding'],
    tools: ['Illustrator'],
    images: [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract and sanitize filename from a Squarespace CDN URL.
 * Decodes URL encoding (+, %XX) and keeps the original filename.
 */
function sanitizeFilename(url: string): string {
  const urlObj = new URL(url);
  const segments = urlObj.pathname.split('/').filter(Boolean);
  // The filename is the last segment
  const raw = segments[segments.length - 1];
  // Decode URL encoding: + → space, %XX → character
  return decodeURIComponent(raw.replace(/\+/g, ' '));
}

/**
 * Download a file with retry logic.
 */
async function downloadFile(url: string, destPath: string): Promise<boolean> {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  [${res.status}] ${url} (attempt ${attempt}/${maxRetries})`);
        if (attempt === maxRetries) return false;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      return true;
    } catch (err: any) {
      console.error(`  [ERR] ${url} — ${err.message} (attempt ${attempt}/${maxRetries})`);
      if (attempt === maxRetries) return false;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return false;
}

/**
 * Run async tasks with a concurrency limit.
 */
async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function generateMarkdown(project: Project, localImagePaths: string[]): string {
  const frontmatter = [
    '---',
    `title: "${project.title}"`,
    `date: "${project.date}"`,
    `tag: "archive"`,
    `excerpt: "${project.excerpt}"`,
  ];

  if (localImagePaths.length > 0) {
    frontmatter.push(`feature_image: "${localImagePaths[0]}"`);
  }

  frontmatter.push('---');

  const lines: string[] = [frontmatter.join('\n'), ''];

  // Description paragraph
  lines.push(project.excerpt);
  lines.push('');

  // Metadata
  lines.push(`**Roles:** ${project.roles.join(', ')}`);
  lines.push('');
  lines.push(`**Tools:** ${project.tools.join(', ')}`);
  lines.push('');

  if (project.agency) {
    lines.push(`**Agency:** ${project.agency}`);
    lines.push('');
  }

  // Images
  for (const imgPath of localImagePaths) {
    lines.push(`![](${imgPath})`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Scraping ${projects.length} Squarespace projects...\n`);

  for (const project of projects) {
    console.log(`\n[${ project.dirId }] ${project.title} (${project.slug})`);

    const imageDir = path.join(PUBLIC_POSTS, String(project.dirId));
    fs.mkdirSync(imageDir, { recursive: true });

    // Download images with concurrency limit
    const localPaths: string[] = [];

    if (project.images.length > 0) {
      console.log(`  Downloading ${project.images.length} images...`);

      const downloadTasks = project.images.map((url) => {
        const filename = sanitizeFilename(url);
        const destPath = path.join(imageDir, filename);
        const publicPath = `/posts/${project.dirId}/${filename}`;
        return { url, destPath, publicPath, filename };
      });

      // Handle duplicate filenames by prefixing with index
      const seenNames = new Map<string, number>();
      for (const task of downloadTasks) {
        const count = seenNames.get(task.filename) || 0;
        seenNames.set(task.filename, count + 1);
        if (count > 0) {
          const ext = path.extname(task.filename);
          const base = path.basename(task.filename, ext);
          const newName = `${base}-${count}${ext}`;
          task.destPath = path.join(imageDir, newName);
          task.publicPath = `/posts/${project.dirId}/${newName}`;
          task.filename = newName;
        }
      }

      await pMap(
        downloadTasks,
        async (task) => {
          const success = await downloadFile(task.url, task.destPath);
          if (success) {
            console.log(`  ✓ ${task.filename}`);
            localPaths.push(task.publicPath);
          } else {
            console.error(`  ✗ FAILED: ${task.filename}`);
          }
        },
        5
      );
    } else {
      console.log('  No images to download.');
    }

    // Write markdown file
    const mdPath = path.join(OUT_DIR, `${project.slug}.md`);
    const markdown = generateMarkdown(project, localPaths);
    fs.writeFileSync(mdPath, markdown);
    console.log(`  → ${path.relative(ROOT, mdPath)}`);
  }

  console.log('\n\nDone! All projects scraped.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
