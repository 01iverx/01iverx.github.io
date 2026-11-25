#!/usr/bin/env node
/**
 * 博客自动翻译：用 Gemini 把文章翻译成另一种语言。
 *
 * 文章放在 src/content/blog/zh/ 或 src/content/blog/en/，两个目录里文件名相同的是同一篇。
 * 脚本为缺少另一种语言版本、或原文改过的文章生成译文。
 *
 * 用法：
 *   npm run translate                      翻译缺失或过期的文章
 *   npm run translate -- --dry-run         只列出要翻译的文章，不调用 API
 *   npm run translate -- --force           重新翻译所有机器译文
 *   npm run translate -- hello-ai-infra    只处理这一篇
 *
 * 环境变量（可以写在项目根目录的 .env 里，见 .env.example）：
 *   GEMINI_API_KEY    必填，在 https://aistudio.google.com/apikey 创建
 *   GEMINI_MODEL      可选，默认 gemini-4-hydrogen
 *   GEMINI_BASE_URL   可选，默认 https://generativelanguage.googleapis.com（走代理或中转时修改）
 *
 * 规则：
 *   - 译文的 frontmatter 带 translatedFrom（原文语言）和 sourceHash（原文指纹）。
 *     原文改过后指纹会变，下次运行时重新翻译。
 *   - 没有 translatedFrom 的文件算人工写的，脚本不会覆盖。
 *     想手动改译文并保留，删掉那篇译文的 translatedFrom 这一行即可。
 *   - 代码块不送去翻译，原样保留。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
// 与 src/i18n.ts 里的 LANGS 保持一致
const LANGS = ['en', 'zh'];
const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese' };

// Gemini Interactions API：https://aistudio.google.com/docs/text-generation
const API_REVISION = '2026-05-20';
const MAX_ATTEMPTS = 5;
const MAX_RETRY_WAIT_MS = 120_000;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const USAGE = `用法：
  npm run translate                      翻译缺失或过期的文章
  npm run translate -- --dry-run         只列出要翻译的文章，不调用 API
  npm run translate -- --force           重新翻译所有机器译文
  npm run translate -- <文章名> ...       只处理这些文章（文件名，不带 .md）`;

// ---------- 参数与配置 ----------

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const only = args.filter((arg) => !arg.startsWith('--'));
for (const flag of flags) {
  if (!['--dry-run', '--force', '--help'].includes(flag)) fail(`未知参数：${flag}\n${USAGE}`);
}
const DRY_RUN = flags.has('--dry-run');
const FORCE = flags.has('--force');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  if (typeof process.loadEnvFile !== 'function') fail('读取 .env 需要 Node.js 20.12 或更新的版本。');
  process.loadEnvFile(envFile);
}
const API_KEY = process.env.GEMINI_API_KEY?.trim();
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';
const BASE_URL = (process.env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');

// ---------- 读取文章 ----------

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function readPost(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const match = raw.match(FRONTMATTER);
  if (!match) throw new Error(`${path.relative(ROOT, file)} 没有 frontmatter（文件开头的 --- 块）`);
  let data;
  try {
    // CORE_SCHEMA：日期保持原样的字符串，不转成 Date
    data = yaml.load(match[1], { schema: yaml.CORE_SCHEMA }) ?? {};
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)} 的 frontmatter 格式有误：${error.reason ?? error.message}`);
  }
  return { file, raw, data, body: raw.slice(match[0].length) };
}

/** 返回 Map：文章名 -> { en?: 文章, zh?: 文章 } */
function readPosts() {
  const posts = new Map();
  for (const lang of LANGS) {
    const dir = path.join(BLOG_DIR, lang);
    if (!fs.existsSync(dir)) continue;
    for (const rel of fs.readdirSync(dir, { recursive: true })) {
      if (!rel.endsWith('.md')) continue;
      const slug = rel.split(path.sep).join('/').replace(/\.md$/, '');
      const versions = posts.get(slug) ?? {};
      versions[lang] = readPost(path.join(dir, rel));
      posts.set(slug, versions);
    }
  }
  return posts;
}

/** 原文指纹：原文内容一变，指纹就变 */
function fingerprint(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

const otherLang = (lang) => LANGS.find((l) => l !== lang);

// ---------- 决定要翻译哪些文章 ----------

function planJobs(posts) {
  const jobs = [];
  const notes = [];

  if (fs.existsSync(BLOG_DIR)) {
    for (const name of fs.readdirSync(BLOG_DIR)) {
      if (name.endsWith('.md')) notes.push(`跳过 src/content/blog/${name}：请放进 en/ 或 zh/ 目录`);
    }
  }
  for (const slug of only) {
    if (!posts.has(slug)) notes.push(`找不到文章：${slug}`);
  }

  for (const [slug, versions] of [...posts].sort(([a], [b]) => a.localeCompare(b))) {
    if (only.length > 0 && !only.includes(slug)) continue;
    const present = LANGS.filter((lang) => versions[lang]);
    const machine = present.filter((lang) => versions[lang].data.translatedFrom);

    if (present.length === 1) {
      const [lang] = present;
      if (machine.length > 0) {
        notes.push(`${slug}：只有译文，找不到原文，已跳过`);
      } else {
        jobs.push({ slug, from: lang, to: otherLang(lang), reason: '缺少译文' });
      }
      continue;
    }

    // 两种语言都有
    if (machine.length === 0) continue; // 两篇都是人工写的
    if (machine.length > 1) {
      notes.push(`${slug}：两个版本都标了 translatedFrom，已跳过`);
      continue;
    }
    const to = machine[0];
    const from = otherLang(to);
    if (versions[to].data.translatedFrom !== from) {
      notes.push(`${slug}：translatedFrom 应为 ${from}，已跳过`);
      continue;
    }
    if (FORCE) {
      jobs.push({ slug, from, to, reason: '强制重译' });
    } else if (versions[to].data.sourceHash !== fingerprint(versions[from].raw)) {
      jobs.push({ slug, from, to, reason: '原文改过' });
    }
  }
  return { jobs, notes };
}

// ---------- 代码块保护：翻译前换成占位符，翻译后换回 ----------

function maskCodeBlocks(markdown) {
  const out = [];
  const blocks = [];
  let fence = null;
  let buffer = [];

  for (const line of markdown.split('\n')) {
    if (!fence) {
      // 列表里的代码块会有缩进，所以不限制缩进
      const open = line.match(/^[ \t]*(`{3,}|~{3,})/);
      if (open) {
        fence = open[1];
        buffer = [line];
      } else {
        out.push(line);
      }
      continue;
    }
    buffer.push(line);
    const close = line.match(/^[ \t]*(`{3,}|~{3,})[ \t]*\r?$/);
    if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
      out.push(`@@CODE_BLOCK_${blocks.length}@@`);
      blocks.push(buffer.join('\n'));
      fence = null;
    }
  }
  if (fence) {
    // 没有闭合的代码块一直延续到文末
    out.push(`@@CODE_BLOCK_${blocks.length}@@`);
    blocks.push(buffer.join('\n'));
  }
  return { text: out.join('\n'), blocks };
}

function restoreCodeBlocks(text, blocks) {
  const seen = text.match(/@@CODE_BLOCK_\d+@@/g) ?? [];
  for (let i = 0; i < blocks.length; i++) {
    const count = seen.filter((token) => token === `@@CODE_BLOCK_${i}@@`).length;
    if (count !== 1) throw new Error(`译文里代码块 ${i} 出现了 ${count} 次（应为 1 次），没有写入`);
  }
  if (seen.length !== blocks.length) throw new Error('译文里多出了未知的代码块占位符，没有写入');
  return text.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => blocks[Number(index)]);
}

// ---------- 调用 Gemini ----------

function systemPrompt(from, to) {
  return [
    `You are a professional technical translator. Translate a blog post from ${LANG_NAMES[from]} to ${LANG_NAMES[to]}.`,
    'The input is JSON with "title", "description" and "body" (Markdown). Reply with the same three keys, translated.',
    'Rules:',
    '- Keep the Markdown structure: headings, lists, tables, links, images, emphasis and line breaks.',
    '- Keep every placeholder line such as @@CODE_BLOCK_0@@ exactly as it is. Each one stands for a code block.',
    '- Do not translate inline code, URLs, file paths, HTML tags or HTML comments.',
    '- Keep technical terms and product names in their usual form (for example C++, Python, AI-Infra, VLA, Thor, Astro, GitHub Actions).',
    `- Write natural, fluent ${LANG_NAMES[to]} for an engineering audience.`,
    '- Do not add or remove content, and do not add notes.',
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['title', 'description', 'body'],
};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Google API 的错误体可能是对象，也可能是只含一个对象的数组 */
function apiError(text) {
  const json = parseJson(text);
  return (Array.isArray(json) ? json[0] : json)?.error ?? null;
}

/** 等待多久再重试：优先听服务器的（Retry-After 或 RetryInfo.retryDelay），否则指数退避 */
function retryWaitMs(attempt, response, text) {
  const header = response?.headers.get('retry-after');
  if (header && /^\d+$/.test(header)) return Number(header) * 1000;
  const delay = apiError(text)?.details?.find((detail) => typeof detail.retryDelay === 'string')?.retryDelay;
  if (delay) return Math.ceil(parseFloat(delay) * 1000);
  return 2 ** attempt * 2000;
}

/** 取最后一段模型输出的文字，规则与官方 SDK 的 output_text 相同 */
function outputText(steps) {
  const parts = [];
  let collecting = false;
  outer: for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.type === 'user_input') break;
    if (step.type === 'thought') continue;
    if (step.type !== 'model_output') {
      if (collecting) break;
      continue;
    }
    const content = step.content ?? [];
    for (let j = content.length - 1; j >= 0; j--) {
      if (content[j].type === 'text') {
        collecting = true;
        parts.push(content[j].text ?? '');
      } else if (collecting) {
        break outer;
      }
    }
  }
  return parts.reverse().join('');
}

async function callGemini(system, input) {
  const request = {
    model: MODEL,
    input,
    system_instruction: system,
    response_format: { type: 'text', mime_type: 'application/json', schema: RESPONSE_SCHEMA },
    store: false,
  };

  for (let attempt = 1; ; attempt++) {
    let response;
    let text = '';
    try {
      response = await fetch(`${BASE_URL}/v1beta/interactions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': API_KEY,
          'api-revision': API_REVISION,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(5 * 60_000),
      });
      text = await response.text();
    } catch (error) {
      if (error.name === 'TimeoutError') throw new Error('Gemini API 超过 5 分钟没有响应');
      if (attempt >= MAX_ATTEMPTS) throw new Error(`连不上 Gemini API：${error.cause?.code ?? error.message}`);
      response = null;
    }

    if (response?.ok) {
      const interaction = parseJson(text);
      if (!interaction) throw new Error('Gemini API 返回的不是 JSON');
      if (interaction.status && interaction.status !== 'completed') {
        throw new Error(`Gemini 没有完成翻译（status: ${interaction.status}）`);
      }
      const result = parseJson(outputText(interaction.steps ?? []));
      for (const key of ['title', 'description', 'body']) {
        if (typeof result?.[key] !== 'string') throw new Error(`Gemini 返回的结果缺少 ${key}`);
      }
      return result;
    }

    const status = response?.status;
    if (response && !RETRY_STATUS.has(status)) {
      throw new Error(`Gemini API ${status}：${apiError(text)?.message ?? text.slice(0, 300)}`);
    }
    const wait = retryWaitMs(attempt, response, text);
    if (attempt >= MAX_ATTEMPTS || wait > MAX_RETRY_WAIT_MS) {
      throw new Error(`Gemini API ${status ?? '连接失败'}：${apiError(text)?.message ?? '重试次数用完了'}`);
    }
    console.log(`  Gemini API ${status ?? '连接失败'}，${Math.ceil(wait / 1000)} 秒后重试（第 ${attempt} 次）`);
    await sleep(wait);
  }
}

// ---------- 翻译一篇 ----------

async function translatePost(job, versions) {
  const source = versions[job.from];
  const { text: body, blocks } = maskCodeBlocks(source.body);
  const input = JSON.stringify({
    title: String(source.data.title ?? ''),
    description: String(source.data.description ?? ''),
    body,
  });
  const result = await callGemini(systemPrompt(job.from, job.to), input);
  const translatedBody = restoreCodeBlocks(result.body, blocks).trim();

  const data = { ...source.data, title: result.title.trim(), description: result.description.trim() };
  delete data.translatedFrom;
  delete data.sourceHash;
  data.translatedFrom = job.from;
  data.sourceHash = fingerprint(source.raw);

  const frontmatter = yaml.dump(data, { schema: yaml.CORE_SCHEMA, lineWidth: -1, flowLevel: 1, quotingType: '"' });
  const target = path.join(BLOG_DIR, job.to, `${job.slug}.md`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `---\n${frontmatter}---\n\n${translatedBody}\n`);
  return target;
}

// ---------- 主流程 ----------

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  if (flags.has('--help')) {
    console.log(USAGE);
    return;
  }

  const posts = readPosts();
  const { jobs, notes } = planJobs(posts);
  for (const note of notes) console.warn(`! ${note}`);

  if (jobs.length === 0) {
    console.log(`没有要翻译的文章（共 ${posts.size} 篇）。`);
    return;
  }
  console.log(`要翻译 ${jobs.length} 篇：`);
  for (const job of jobs) console.log(`  ${job.from} -> ${job.to}  ${job.slug}（${job.reason}）`);
  if (DRY_RUN) return;

  if (!API_KEY) {
    fail('没有找到 GEMINI_API_KEY。把 .env.example 复制成 .env，填入 key。key 在 https://aistudio.google.com/apikey 创建。');
  }

  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    const started = Date.now();
    console.log(`翻译 ${job.slug}（${job.from} -> ${job.to}，模型 ${MODEL}）...`);
    try {
      const target = await translatePost(job, posts.get(job.slug));
      done++;
      console.log(`  完成，用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒 -> ${path.relative(ROOT, target)}`);
    } catch (error) {
      failed++;
      console.error(`  失败：${error.message}`);
    }
  }
  console.log(`\n翻译完成 ${done} 篇，失败 ${failed} 篇。${done > 0 ? '请检查译文后再提交。' : ''}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => fail(error.message));
