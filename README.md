# 01iverx

> Indie Developer

**English** | [简体中文](./README_cn.md)

<!-- profile:intro:start -->
Hi, I'm **01iverx**, an indie developer focused on high-performance systems engineering and AI infrastructure, with a passion for driving low-level compute and toolchains through clean, efficient architecture.
<!-- profile:intro:end -->

## Skills

- **C++**: High-performance systems programming, memory and concurrency tuning, and low-latency core engines.
- **Python**: Engineering automation, service orchestration and AI ecosystem development, bridging the system and application layers.
- **AI-Infra**: Model deployment acceleration across the full pipeline: VLA model export → operator optimization → quantization → Thor deployment.
- **Autonomous Driving Map Engine**: On-vehicle map engine architecture and high-performance data broadcasting, covering map ODD, driving & parking maps, and overseas compliance & simulation pipelines.

---

## Local Development & Writing

```bash
# Install dependencies
npm install

# Local preview (http://localhost:4321)
npm run dev

# Production build
npm run build
```

- **New blog post**: add a `.md` file under `src/content/blog/en/` (English) or `src/content/blog/zh/` (Chinese) and push to `main`. GitHub Actions builds and deploys it to [01iverx.github.io](https://01iverx.github.io). A post with the same file name in both folders is one post in two languages.
- **Translate posts**: run `npm run translate` to create the missing language version with Gemini, then review and commit it. Put your key in `.env` first (copy `.env.example`; get a key at [Google AI Studio](https://aistudio.google.com/apikey)). The script also re-translates a post when its original changes. `npm run translate -- --dry-run` shows what it would do. Machine translations carry `translatedFrom` in their frontmatter; delete that line to keep your own edits.
- **Update your profile**: edit the intro and skills in `README.md` (English, shown at `/`) or `README_cn.md` (Chinese, shown at `/zh/`). The site syncs them at build time.
