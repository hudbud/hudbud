---
title: "CarvanaDS"
date: "2024-05-30T18:21-07:00"
tags: ["work"]
category: "portfolio"
excerpt: "Four products, four design languages, one big mess — unifying Carvana under a single design system, then getting a 10,000-person company to actually adopt it."
feature_image: "https://media.hudbud.net/posts/68/cover.webp"
roles: "Senior Product Designer, Design Systems"
tools: "Figma"
---

**Exploring, defining, centralizing, and unifying under a shared vision.**

**Roles:** Senior Product Designer, Design Systems

**Tools:** Figma

I joined Carvana's design systems team and spent the first couple weeks auditing what already existed. Four products, each built and maintained on its own — four UI kits that looked the same, nine-plus component libraries quietly duplicating the same code, twenty-plus designers working in silos, a hundred-plus engineers with no shared source of truth. Common enough for a startup. Less workable at a 10,000-person company.

<div style="margin:16px 0"><img src="https://media.hudbud.net/posts/68/the-math.webp" alt="" style="width:100%;border-radius:2px;display:block" /></div>

I started with direction, not components — a week-long bake-off with design leadership to settle the brand's visual language — then built what that direction actually stood on: a full token and Figma Variables system covering color, type, space, radius, shadow, and breakpoints, AAA-accessible from the start. That foundation got tested fast — when Carvana acquired ADESA and needed its site rebuilt in under two months, a theming layer on top of the same components made it possible without a redesign from scratch.

From there, the component library itself: rebuilt against an audit of every screen across the business, with the flexibility — slots, nested properties, responsive variants — to hold up outside the one screen each was originally built for. The icon set followed, moving off an aging duotone style onto Lucide and redesigning the fifty-plus icons that didn't have an equivalent. Every component got documented for design and engineering alike.

The harder problem was adoption. I built a five-module, thirty-eight-lesson onboarding course — the "Test Kitchen" — that ran 30+ designers through the system via a fake restaurant brand, gamified with a Figma avatar creator with over four million possible combinations. I proposed and built a design system website as the org's single source of truth. Designers started using it fast — one button component alone crossed 83,000 instances — which surfaced the real problem: it's not a design system until it's built. A system existed on paper, but nobody had actually shipped it in code. I ran cross-org 1:1s with nearly every frontend engineer at the company, grew a volunteer maintainers team out of a hackathon project, and turned a fragmented, over-opinionated first attempt into one system, built by a centralized team, that people actually wanted to use.

<div style="margin:16px 0"><img src="https://media.hudbud.net/posts/68/by-the-numbers.webp" alt="" style="width:100%;border-radius:2px;display:block" /></div>

Four products became one library — 56+ components, 1,084+ variants, 16+ patterns, covering every vertical in the business.

Most of the detail behind this work is private. Contact me if you'd like to dive in.
