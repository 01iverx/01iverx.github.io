/**
 * 站点双语配置：英文是默认语言，放在根路径（/、/blog/）；
 * 中文放在 /zh/ 前缀下（/zh/、/zh/blog/）。
 */
export const LANGS = ['en', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

/** <html lang> 和 hreflang 用的语言代码 */
export const HTML_LANG: Record<Lang, string> = { en: 'en', zh: 'zh-CN' };

/** 语言切换按钮上的文字 */
export const LANG_LABELS: Record<Lang, string> = { en: 'EN', zh: '中文' };

export const UI = {
  en: {
    siteDescription: '01iverx — indie developer focused on C++, Python and AI-Infra.',
    navLabel: 'Main navigation',
    langLabel: 'Language',
    blogDescription: "01iverx's engineering notes on C++, Python and AI-Infra.",
    blogSubtitle: 'Systems engineering notes on C++, Python and AI-Infra.',
    machineTranslated: 'This post was machine-translated from Chinese.',
    readOriginal: 'Read the original',
    untranslated: 'This post is not available in English yet.',
  },
  zh: {
    siteDescription: '01iverx — 独立开发者，专注于 C++、Python 与 AI-Infra。',
    navLabel: '主导航',
    langLabel: '语言',
    blogDescription: '01iverx 的 C++、Python 与 AI-Infra 技术笔记。',
    blogSubtitle: '记录 C++、Python 与 AI-Infra 的系统工程笔记。',
    machineTranslated: '本文由英文原文机器翻译。',
    readOriginal: '阅读原文',
    untranslated: '本文暂无中文版。',
  },
} satisfies Record<Lang, Record<string, string>>;

/** 给路径加上语言前缀：localePath('zh', '/blog/') -> '/zh/blog/' */
export function localePath(lang: Lang, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === DEFAULT_LANG ? clean : `/${lang}${clean}`;
}

/** 去掉语言前缀：'/zh/blog/a/' -> { lang: 'zh', path: '/blog/a/' } */
export function splitLangPath(pathname: string): { lang: Lang; path: string } {
  const clean = pathname.replace(/index\.html$/, '') || '/';
  for (const lang of LANGS) {
    if (lang === DEFAULT_LANG) continue;
    const prefix = `/${lang}`;
    if (clean === prefix || clean.startsWith(`${prefix}/`)) {
      return { lang, path: clean.slice(prefix.length) || '/' };
    }
  }
  return { lang: DEFAULT_LANG, path: clean };
}

/** [...locale] 路由用的 getStaticPaths：英文的 locale 为空（根路径），中文为 'zh' */
export function localeStaticPaths() {
  return LANGS.map((lang) => ({
    params: { locale: lang === DEFAULT_LANG ? undefined : lang },
    props: { lang },
  }));
}
