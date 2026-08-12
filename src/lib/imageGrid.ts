// Markdown renders a run of images differently depending on spacing:
// blank-line-separated images become one <p><img></p> per image, adjacent
// image lines collapse into a single <p> holding every <img>, and a caption
// line written directly above an image block ("Yikes\n![](...)") lands in
// the SAME <p> as the images. Normalize all three shapes here — CSS can't
// merge consecutive paragraphs. Column count is responsive via
// .post-img-grid in global.css (2 cols mobile, 3 desktop). Raw-HTML blocks
// in case-study posts (e.g. hand-authored <video> grids) never match
// <p>-wrapped <img> runs and pass through untouched.
const MIXED_PARAGRAPH = /<p>([\s\S]*?)<\/p>/g;
const IMG_RUN = /(?:<p>\s*(?:<img\s[^>]*>\s*)+<\/p>\s*)+/g;
const IMG_TAG = /<img\s[^>]*>/g;

// Split paragraphs that mix text and images (caption-above-images style)
// into a text paragraph plus image-only paragraphs the grid pass can group.
function splitMixedParagraphs(html: string): string {
  return html.replace(MIXED_PARAGRAPH, (whole, content) => {
    if (!IMG_TAG.test(content)) return whole;
    IMG_TAG.lastIndex = 0;
    const text = content.replace(IMG_TAG, '').replace(/<br\s*\/?>/g, ' ').trim();
    if (!text) return whole;
    const parts: string[] = [];
    // Preserve order: text chunks and img runs emitted as they appear.
    let rest = content;
    while (rest) {
      const m = rest.match(/(?:<img\s[^>]*>\s*)+/);
      if (!m || m.index === undefined) { const t = rest.trim(); if (t) parts.push(`<p>${t}</p>`); break; }
      const before = rest.slice(0, m.index).trim();
      if (before) parts.push(`<p>${before}</p>`);
      parts.push(`<p>${(m[0].match(IMG_TAG) ?? []).join('')}</p>`);
      rest = rest.slice(m.index + m[0].length);
    }
    return parts.join('\n');
  });
}

export function groupImagesIntoGrid(html: string): string {
  return splitMixedParagraphs(html).replace(IMG_RUN, (run) => {
    const imgs = run.match(IMG_TAG) ?? [];
    if (imgs.length < 2) return run;
    return `<div class="post-img-grid">${imgs.join('')}</div>\n`;
  });
}

// Roles/Tools/Agency written into the markdown body duplicate the frontmatter
// that detail pages now render as a spec table — drop those paragraphs.
export function stripMetaParagraphs(html: string): string {
  return html.replace(/<p><strong>(Roles|Tools|Agency):<\/strong>[\s\S]*?<\/p>\s*/g, '');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Editorial figure numbering: every image (or image grid) in the body gets a
// "fig. nn — title" caption. Run AFTER groupImagesIntoGrid. `start` lets the
// caller reserve fig. 01 for a hero image rendered outside this HTML.
export function addFigCaptions(html: string, title: string, start = 1): string {
  let n = start;
  const pad = (x: number) => String(x).padStart(2, '0');
  const label = escapeHtml(title);
  return html.replace(
    /<p>\s*(<img\s[^>]*>)\s*<\/p>|<div class="post-img-grid">[\s\S]*?<\/div>/g,
    (whole, single) => {
      if (single) {
        const cap = `<figcaption class="post-fig-caption">fig. ${pad(n++)} — ${label}</figcaption>`;
        return `<figure class="post-fig">${single}${cap}</figure>`;
      }
      const count = (whole.match(/<img/g) ?? []).length;
      const a = n;
      const b = n + count - 1;
      n = b + 1;
      const range = b > a ? `fig. ${pad(a)}–${pad(b)}` : `fig. ${pad(a)}`;
      return `<figure class="post-fig">${whole}<figcaption class="post-fig-caption">${range} — ${label}</figcaption></figure>`;
    }
  );
}
