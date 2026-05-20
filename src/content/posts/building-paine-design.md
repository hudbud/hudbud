---
title: "Building paine.design"
date: "2026-05-20"
tag: "thoughts"
excerpt: "How this site came together — from architecture decisions to scraping old content to building an image graph that looks like a galaxy."
feature_image: "/posts/graph-zoomed-in.jpg"
---

I rebuilt my personal site from scratch. Again. But this time it stuck, and the process was weird enough to write about.

## The architecture

The site is Astro 5 with React islands. One big component — `Portfolio.tsx` — handles the entire single-page app experience: a two-column layout with tabs, a scrolling image gallery, post rendering, lightbox, theming, and a bottom chrome bar with dropups. Everything is inline styles and CSS custom properties. No Tailwind, no component library. Just vibes.

Content lives in Astro's content collections as markdown files with Zod-validated frontmatter. Posts have a `tag` field that sorts them into tabs: work, thoughts, life, archive. The schema also carries optional `roles`, `tools`, and `agency` fields for case studies.

The site ships 198 Monkeytype themes and 5 fonts. On first visit you get earthsong + Apfel Grotezk. After that it randomizes unless you lock it.

## Collating the content

The hardest part wasn't writing code — it was getting all my old work into one place.

**Ghost CMS** — My blog was on Ghost. I exported the JSON, wrote a migration script that converted posts to markdown, downloaded all images, and dropped Ghost entirely. The content now lives in the repo.

**Squarespace** — My old portfolio at paine.design ran on Squarespace. I exported the XML (got 18 pages, 369 images), then realized the XML was missing all the project case study pages. So I put the old site back up and wrote a scraper that crawled every project page, downloaded all images at full resolution, and generated markdown posts with proper frontmatter. 20 more projects, 145 images, 170MB.

**Organization** — Everything dumped into one "archive" tag was useless. I split it: 12 professional case studies became `work` (with agency, roles, tools metadata), and the rest stayed `archive` with filter chips by category (branding, motion, illustration, product, film, photo). The work tab doubles as a resume — it shows the timeline up top, then clickable case studies below with the agency and primary role as context.

## The image graph

This is the fun one.

I wanted an Obsidian-style graph view but for images. Every image on the site, floating in space, clustered by which post it belongs to. Click one and you go to that post.

![](/posts/graph-zoomed-out.png)

It's a full-screen canvas app at `/graph`. The layout is pre-computed: posts are hub nodes placed in a golden-angle spiral (so they fill space evenly), and images branch off their parent hub in a ring. A gentle spring simulation runs for about 200 frames to settle everything, then stops. No external dependencies — just `requestAnimationFrame`, basic vector math, and progressive image loading in batches of 30.

![](/posts/graph-zoomed-in.jpg)

Zoomed in you can see each cluster is a post — the Big Sur photos, the keyboard build, the Blaze Pizza UI screens. The hub-to-hub connections form a loose chain so the whole thing reads like a tree. Scroll to zoom, drag to pan, hover to see the post name, click to navigate.

It looks like a galaxy. Which is kind of the point. 1,048 images across 56 posts, one weird constellation.

![](/posts/graph-clusters.jpg)

The clusters are satisfying — you can see which posts are photo-heavy (the Big Sur and travel clusters are massive rings) versus the branding projects (tight little circles of logos). Still a work in progress. The next version will show one image per post at the top level and only expand into children when you click in, so it's not trying to load everything at once.

## The small stuff

A few other things that made the site feel right:

- **Lightbox** — Click any image in a post to view fullscreen with arrow key navigation and a counter.
- **Gallery as default** — The right panel shows a scrolling grid of every image on the site. Click one and you're in that post. The grid uses fixed `aspect-ratio: 4/3` cells so nothing reflows as images load.
- **Mobile** — Single column, shows left panel by default, switches to right panel when you open a post. Simple.
- **Bio hovers** — The intro paragraph has inline links that pop a preview card on hover. Each card checks its position against the scrollable parent container so it doesn't bleed off-screen.
- **hudsonland** — My uncle built me a website before I was five. Race car GIFs, big letters. The hover card for the origin story now shows a GIF of race cars. Full circle.

## The tools

Built with Claude Code. The whole thing — architecture, migration scripts, component work, the graph, this post. I'd describe the pattern as: I say what I want in plain language, it writes the code, I check the browser, I say what's wrong, repeat. It's fast and the iteration loop is tight. Like pair programming where your partner types 10x faster than you and never gets tired, but occasionally puts `wordCount` in a file twice.
