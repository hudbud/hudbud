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

export default defineConfig({
  output: 'static',
  site: 'https://paine.design',
  integrations: [react(), sitemap()],
  markdown: {
    rehypePlugins: [rehypeLazyImages],
  },
});
