import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 文章按语言分目录：src/content/blog/en/<slug>.md 和 src/content/blog/zh/<slug>.md
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // 以下两项由 npm run translate 写入：机器译文的原文语言，以及翻译时原文的指纹
    translatedFrom: z.enum(['en', 'zh']).optional(),
    sourceHash: z.string().optional(),
  }),
});

export const collections = { blog };
