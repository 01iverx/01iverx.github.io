import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LANG, type Lang } from '../i18n';

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  level: number;
  accent: 'cyan' | 'yellow' | 'pink';
}

export interface ProfileData {
  name: string;
  role: string;
  intro: string;
  skills: SkillItem[];
}

/** GitHub 主页 */
export const GITHUB_URL = 'https://github.com/01iverx';

/** 每种语言读哪个文件：英文 README.md，中文 README_cn.md */
export const README_FILES: Record<Lang, string> = {
  en: 'README.md',
  zh: 'README_cn.md',
};

/** README 里缺少对应内容时的兜底文字 */
const DEFAULTS: Record<Lang, Pick<ProfileData, 'name' | 'role' | 'intro'>> = {
  en: {
    name: '01iverx',
    role: 'Indie Developer',
    intro: "Hi, I'm 01iverx, an indie developer.",
  },
  zh: {
    name: '01iverx',
    role: '独立开发者 · Indie Developer',
    intro: '你好，我是 01iverx，一名独立开发者。',
  },
};

const ACCENTS: Array<'cyan' | 'yellow' | 'pink'> = ['cyan', 'yellow', 'pink'];

/** 读取该语言的 README；文件不存在时退回英文的 README.md */
function readReadme(lang: Lang): string {
  for (const file of [README_FILES[lang], README_FILES[DEFAULT_LANG]]) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

/**
 * 构建时读取根目录的 README（英文 README.md / 中文 README_cn.md），
 * 让仓库简介与个人主页使用同一份内容。
 */
export function loadProfileFromReadme(lang: Lang = DEFAULT_LANG): ProfileData {
  const raw = readReadme(lang);
  const fallback = DEFAULTS[lang];

  const nameMatch = raw.match(/^#\s+(.+)$/m);
  const roleMatch = raw.match(/^>\s+(.+)$/m);
  const introMatch = raw.match(
    /<!--\s*profile:intro:start\s*-->([\s\S]*?)<!--\s*profile:intro:end\s*-->/
  );

  // 技能段落标题：英文 "## Skills"，中文 "## 专业技能"
  const skillSectionMatch = raw.match(/##\s+(?:Skills|专业技能)([\s\S]*?)(?:\n---|\n##\s|$)/i);
  const skills: SkillItem[] = [];

  if (skillSectionMatch) {
    const lines = skillSectionMatch[1].split('\n');
    let idx = 0;
    for (const line of lines) {
      const m = line.match(/^\s*-\s+\*\*(.+?)\*\*[：:]\s*(.+)$/);
      if (m) {
        idx += 1;
        skills.push({
          id: `MOD_${String(idx).padStart(2, '0')}`,
          name: m[1].trim(),
          description: m[2].trim(),
          level: m[1].toLowerCase().includes('infra') ? 8 : 7,
          accent: ACCENTS[(idx - 1) % ACCENTS.length],
        });
      }
    }
  }

  if (skills.length === 0) {
    console.warn(
      `[profile] No skills found in ${README_FILES[lang]} (expected a "## Skills" or "## 专业技能" list).`
    );
  }

  return {
    name: nameMatch ? nameMatch[1].trim() : fallback.name,
    role: roleMatch ? roleMatch[1].trim() : fallback.role,
    intro: introMatch ? introMatch[1].trim().replace(/\*\*(.+?)\*\*/g, '$1') : fallback.intro,
    skills,
  };
}
