---
title: "Hello, AI-Infra: My Engineering Blog Is Live"
description: Documenting the architecture design behind upgrading 01iverx.github.io from a single-file page to an Astro static blog, along with upcoming writing topics in C++, Python, and AI-Infra.
date: 2026-11-24
tags: [AI-Infra, C++, Engineering]
draft: false
translatedFrom: zh
sourceHash: 313cac8df5db
---

Welcome to **01iverx**'s personal space. Here, I will regularly share practical notes on **high-performance C++ systems**, **Python toolchains**, and **AI-Infra**.

## Why Choose a Static Engineering Architecture?

1. **Single Source of Truth**: The bio is parsed directly from `README.md` in the repository root, keeping the GitHub repository page and personal homepage automatically in sync.
2. **Markdown-Driven**: To add a new post, simply place it in `src/content/blog/`, or visually edit and publish it in the browser via Pages CMS.
3. **Automated Build & Deployment**: Pushing to `main` triggers GitHub Actions to automatically build and deploy to GitHub Pages, with zero database maintenance overhead.

## Code Highlighting Example

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

> You can directly edit or delete this sample post to start writing your first technical note.
