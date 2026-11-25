import fs from 'node:fs';
import path from 'node:path';

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

const ACCENTS: Array<'cyan' | 'yellow' | 'pink'> = ['cyan', 'yellow', 'pink'];

/**
 * 构建时直接读取根目录 README.md，实现仓库简介与个人主页单一内容源同步。
 */
export function loadProfileFromReadme(): ProfileData {
  const readmePath = path.resolve(process.cwd(), 'README.md');
  const raw = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf-8') : '';

  const nameMatch = raw.match(/^#\s+(.+)$/m);
  const roleMatch = raw.match(/^>\s+(.+)$/m);
  const introMatch = raw.match(
    /<!--\s*profile:intro:start\s*-->([\s\S]*?)<!--\s*profile:intro:end\s*-->/
  );

  const skillSectionMatch = raw.match(/##\s+专业技能([\s\S]*?)(?:\n---|\n##\s|$)/);
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

  return {
    name: nameMatch ? nameMatch[1].trim() : '01iverx',
    role: roleMatch ? roleMatch[1].trim() : '独立开发者 · Indie Developer',
    intro: introMatch
      ? introMatch[1].trim().replace(/\*\*(.+?)\*\*/g, '$1')
      : '你好，我是 01iverx，一名独立开发者。专注高性能系统工程与人工智能基础设施。',
    skills:
      skills.length > 0
        ? skills
        : [
            {
              id: 'MOD_01',
              name: 'C++',
              description: '高性能系统编程、内存与并发调优，构建低延迟核心引擎。',
              level: 7,
              accent: 'cyan',
            },
            {
              id: 'MOD_02',
              name: 'Python',
              description: '工程自动化、服务编排与 AI 生态开发。',
              level: 7,
              accent: 'yellow',
            },
            {
              id: 'MOD_03',
              name: 'AI-Infra',
              description: '专注模型部署加速，打通 VLA 模型导出 → 算子优化 → 量化 → Thor 部署全链路。',
              level: 8,
              accent: 'pink',
            },
            {
              id: 'MOD_04',
              name: '自动驾驶地图引擎',
              description: '车端地图引擎架构与高性能数据播发，覆盖地图 ODD、行泊车地图、海外合规与仿真 Pipeline。',
              level: 7,
              accent: 'cyan',
            },
          ],
  };
}
