import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

/** Adds loading="lazy" decoding="async" to every <img> rendered from markdown. */
function rehypeLazyImages() {
  return (tree) => {
    const visit = (node) => {
      if (node.tagName === 'img') {
        node.properties = node.properties || {};
        if (node.properties.loading === undefined) node.properties.loading = 'lazy';
        if (node.properties.decoding === undefined) node.properties.decoding = 'async';
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}

/** Opens external links from markdown in a new tab with rel="noopener". */
function rehypeExternalLinks() {
  return (tree) => {
    const visit = (node) => {
      if (node.tagName === 'a' && /^https?:\/\//.test(node.properties?.href ?? '')) {
        node.properties.target = '_blank';
        node.properties.rel = 'noopener';
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}

export default defineConfig({
  output: 'static',
  site: 'https://hudbud.net',
  integrations: [react(), sitemap()],
  markdown: {
    rehypePlugins: [rehypeLazyImages, rehypeExternalLinks],
  },
});
