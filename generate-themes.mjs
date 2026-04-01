/**
 * Temporary script: parse monkeytype-themes.ts → assets/js/themes.js
 * Run: node generate-themes.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('/tmp/monkeytype-themes.ts', 'utf8');

// Find the themes object start
const startIdx = src.indexOf('= {', src.indexOf('themes:'));
// Extract each theme block - match "name": { ... } or name: { ... }
const themesSection = src.slice(startIdx + 2);

const themes = {};
// Match theme blocks: optional quotes around name, then { ... }
const blockRegex = /(?:"([^"]+)"|(\w+))\s*:\s*\{([^}]+)\}/g;
let match;
while ((match = blockRegex.exec(themesSection)) !== null) {
  const name = match[1] || match[2];
  const body = match[3];

  const get = (key) => {
    const m = body.match(new RegExp(key + '\\s*:\\s*"([^"]+)"'));
    return m ? m[1] : null;
  };

  const bg = get('bg');
  const main = get('main');
  const sub = get('sub');
  const subAlt = get('subAlt');
  const text = get('text');

  if (bg && main && sub && subAlt && text) {
    themes[name] = { bg, main, sub, subAlt, text };
  }
}

const count = Object.keys(themes).length;
console.log(`Extracted ${count} themes`);

const output = `/**
 * Monkeytype color themes (auto-generated)
 * ${count} themes extracted from monkeytype source
 */
var MT_THEMES = ${JSON.stringify(themes, null, 2)};
`;

writeFileSync('assets/js/themes.js', output);
console.log('Wrote assets/js/themes.js');
