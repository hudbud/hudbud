export const prerender = false;

import type { APIRoute } from 'astro';
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getNextPostNumber(): number {
  const postsDir = join(process.cwd(), 'public', 'posts');
  if (!existsSync(postsDir)) return 1;
  const dirs = readdirSync(postsDir)
    .filter((d) => /^\d+$/.test(d))
    .map(Number);
  return dirs.length > 0 ? Math.max(...dirs) + 1 : 1;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const tag = formData.get('tag') as string;
    const date = formData.get('date') as string;
    const excerpt = formData.get('excerpt') as string;
    const mode = formData.get('mode') as string || 'local';
    const momentsJson = formData.get('moments') as string;
    const imageFiles = formData.getAll('images') as File[];

    if (!title || !tag || !date) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const moments: { caption: string; imageIndexes: number[] }[] = JSON.parse(momentsJson || '[]');
    const slug = slugify(title);

    let imageUrls: string[] = [];

    if (mode === 'blob') {
      // Vercel Blob upload
      const { put } = await import('@vercel/blob');
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const buffer = Buffer.from(await file.arrayBuffer());
        const blobPath = `posts/${slug}/${file.name}`;
        const blob = await put(blobPath, buffer, {
          access: 'public',
          addRandomSuffix: false,
        });
        imageUrls.push(blob.url);
      }
    } else {
      // Local mode — save to public/posts/<n>/
      const postNumber = getNextPostNumber();
      const imageDir = join(process.cwd(), 'public', 'posts', String(postNumber));
      mkdirSync(imageDir, { recursive: true });

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = join(imageDir, file.name);
        writeFileSync(filePath, buffer);
        imageUrls.push(`/posts/${postNumber}/${file.name}`);
      }
    }

    // Generate markdown body from moments
    const bodyParts: string[] = [];
    for (const moment of moments) {
      if (moment.caption) {
        bodyParts.push(moment.caption);
        bodyParts.push('');
      }
      for (const idx of moment.imageIndexes) {
        if (imageUrls[idx]) {
          bodyParts.push(`![](${imageUrls[idx]})`);
        }
      }
      bodyParts.push('');
    }

    const body = bodyParts.join('\n').trim();
    const featureImage = imageUrls.length > 0 ? imageUrls[0] : '';

    // Build frontmatter
    const frontmatterLines = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `date: "${date}T12:00:00"`,
      `tag: "${tag}"`,
    ];
    if (excerpt) frontmatterLines.push(`excerpt: "${excerpt.replace(/"/g, '\\"')}"`);
    if (featureImage) frontmatterLines.push(`feature_image: "${featureImage}"`);
    frontmatterLines.push('---');

    const markdown = frontmatterLines.join('\n') + '\n\n' + body + '\n';
    const outPath = join('src', 'content', 'posts', `${slug}.md`);
    const fullPath = join(process.cwd(), outPath);

    writeFileSync(fullPath, markdown, 'utf-8');

    return new Response(JSON.stringify({ success: true, path: outPath }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
