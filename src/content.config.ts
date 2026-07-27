import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    dateLabel: z.string().optional(),
    tags: z.array(z.enum(['thoughts', 'life', 'resources', 'archive', 'work'])).min(1),
    category: z.enum(['branding', 'motion', 'illustration', 'product', 'film', 'photo']).optional(),
    excerpt: z.string().optional(),
    feature_image: z.string().optional(),
    draft: z.boolean().default(false),
    roles: z.string().optional(),
    tools: z.string().optional(),
    agency: z.string().optional(),
  }),
});

export const collections = { posts };
