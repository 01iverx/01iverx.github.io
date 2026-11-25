---
title: "Hello, AI-Infra：我的工程化博客上线了"
description: "记录 01iverx.github.io 从单文件页面升级为 Astro 静态博客的架构设计，以及后续 C++ / Python / AI-Infra 的写作方向。"
date: 2026-11-24
tags: ["AI-Infra", "C++", "Engineering"]
draft: false
---

欢迎来到 **01iverx** 的个人空间。这里会持续记录我在 **C++ 高性能系统**、**Python 工具链** 与 **AI-Infra** 方向的实战笔记。

## 为什么选择静态工程化架构？

1. **单一内容源**：个人简介直接从仓库根目录的 `README.md` 解析，GitHub 仓库页与个人主页自动保持一致。
2. **Markdown 驱动**：新文章只需放入 `src/content/blog/`，或者通过 Pages CMS 在浏览器里可视化编辑发布。
3. **自动构建部署**：推送到 `main` 后由 GitHub Actions 自动编译并发布到 GitHub Pages，零数据库运维成本。

## 代码高亮示例

```cpp
#include <iostream>
#include <vector>

int main() {
  std::vector<const char*> stack = {"C++", "Python", "AI-Infra"};
  for (const auto* item : stack) {
    std::cout << "[LOADED] " << item << '\n';
  }
  return 0;
}
```

> 你可以直接修改或删除这篇示例文章，开始记录你的第一篇技术笔记。
