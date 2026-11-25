import { getCollection, type CollectionEntry } from 'astro:content';
import { LANGS, type Lang } from './i18n';

export type BlogPost = CollectionEntry<'blog'>;

export interface LocalizedPost {
  /** 文章路径，不含语言目录，例如 'hello-ai-infra' */
  slug: string;
  /** 要显示的那个版本 */
  post: BlogPost;
  /** post 的语言；和页面语言不同，说明这篇还没有该语言的版本 */
  postLang: Lang;
}

const warned = new Set<string>();

/** 文章 id 的第一段是语言目录：'zh/hello-ai-infra' -> { lang: 'zh', slug: 'hello-ai-infra' } */
function splitPostId(id: string): { lang: Lang; slug: string } | null {
  const [dir, ...rest] = id.split('/');
  const lang = LANGS.find((l) => l === dir);
  return lang && rest.length > 0 ? { lang, slug: rest.join('/') } : null;
}

/**
 * 某种语言的文章列表，按日期从新到旧。每篇文章只出现一次：
 * 优先用该语言的版本，没有就用另一种语言的版本。
 */
export async function getLocalizedPosts(lang: Lang): Promise<LocalizedPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const bySlug = new Map<string, Partial<Record<Lang, BlogPost>>>();

  for (const post of posts) {
    const parsed = splitPostId(post.id);
    if (!parsed) {
      if (!warned.has(post.id)) {
        warned.add(post.id);
        console.warn(`[blog] Skipped "${post.id}": put posts in src/content/blog/en/ or src/content/blog/zh/.`);
      }
      continue;
    }
    const versions = bySlug.get(parsed.slug) ?? {};
    versions[parsed.lang] = post;
    bySlug.set(parsed.slug, versions);
  }

  return [...bySlug]
    .map(([slug, versions]) => {
      const postLang = versions[lang] ? lang : LANGS.find((l) => versions[l])!;
      return { slug, postLang, post: versions[postLang]! };
    })
    .sort((a, b) => b.post.data.date.valueOf() - a.post.data.date.valueOf());
}
