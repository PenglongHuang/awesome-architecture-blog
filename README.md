# AI架构师之路

> 用「纸本杂志」的方式，把架构判断力整理成一套可读、可查、可练的中文知识库。

[![Deploy](https://github.com/PenglongHuang/awesome-architecture-blog/actions/workflows/deploy.yml/badge.svg)](https://github.com/PenglongHuang/awesome-architecture-blog/actions/workflows/deploy.yml)

**线上入口：** [GitHub Pages](https://penglonghuang.github.io/awesome-architecture-blog/) · [自建镜像](http://118.196.50.229/awesome-architecture-blog/)

80 篇架构笔记、1 门交互式项目课程、1 张可交互架构总览图，集中在一个纯静态站点里。

## 站点内容

| 板块 | 路径 | 内容 |
|---|---|---|
| [入门教程](https://penglonghuang.github.io/awesome-architecture-blog/tutorial/) | `/tutorial/` | 43 篇从架构思维到实战的入门教程 |
| [架构地图](https://penglonghuang.github.io/awesome-architecture-blog/templates/) | `/templates/` | 31 张真实系统的架构地图 |
| [系统设计](https://penglonghuang.github.io/awesome-architecture-blog/cases/) | `/cases/` | 6 个端到端的系统设计推演 |
| [项目学习](https://penglonghuang.github.io/awesome-architecture-blog/learning/) | `/learning/` | 交互式项目课程，首门为 LiteLLM 源码漫游 |
| [搜索](https://penglonghuang.github.io/awesome-architecture-blog/search/) | `/search/` | Pagefind 本地静态索引 |

项目学习除了课程正文，还包含一张可交互架构总览图：

- [LiteLLM 内部漫游指南](https://penglonghuang.github.io/awesome-architecture-blog/learning/litellm/)
- [LiteLLM Proxy 架构总览](https://penglonghuang.github.io/awesome-architecture-blog/learning/litellm/architecture.html)

站点是纯静态的多页应用（MPA），没有数据库和前端框架运行时：

- 内容构建时编译为 HTML
- 搜索由 Pagefind 在浏览器本地用 WASM 完成
- 评论由 giscus 承载，数据存在 GitHub Discussions
- 主题、Quiz、课程筛选、目录等交互使用少量原生 JS

## 内容生产管线

这个站点不是手写 HTML 堆出来的。文章、课程和架构图分别由不同工具生产，最后汇聚到同一条静态构建管线：

```text
awesome-architecture
        │ pnpm import
        ▼
Astro Content Collections ─────────────────────────────┐
                                                       │
真实代码库 ── codebase-to-course ──> 课程 HTML ────────┤
                                                       ├──> Astro + Pagefind
系统结构 ──── Archify ────────────> 可交互架构图 ──────┘        │
                                                              ├─> GitHub Pages
                                                              └─> 自建 Nginx
```

| 环节 | 生产工具 | 在本站中的产物 |
|---|---|---|
| 文章整理 | [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture) | `src/content/posts/` 下的 80 篇 Markdown |
| 项目课程 | [codebase-to-course](https://github.com/zarazhangrui/codebase-to-course) | [LiteLLM 内部漫游指南](https://penglonghuang.github.io/awesome-architecture-blog/learning/litellm/) |
| 架构图 | [Archify](https://github.com/tt-a1i/archify) | [LiteLLM Proxy 架构总览](https://penglonghuang.github.io/awesome-architecture-blog/learning/litellm/architecture.html) |
| 站点构建 | Astro + Pagefind | GitHub Pages 与自建 Nginx 镜像 |

### codebase-to-course

[codebase-to-course](https://github.com/zarazhangrui/codebase-to-course) 是一个把代码库变成交互式 HTML 课程的生产项目。它面向不写代码、但需要理解系统的读者，把源码、数据流和概念拆成可滚动阅读的模块。

本站用它生成了 LiteLLM 课程：

- 8 个模块，围绕一次 `/v1/chat/completions` 请求展开
- 包含代码与中文解释并排、Quiz、术语提示和数据流动画
- 课程是自包含的独立 HTML，不进入 Astro 组件树
- 课程入口由 `/learning/` 统一索引、分类和筛选

### Archify

[Archify](https://github.com/tt-a1i/archify) 是一个把系统结构渲染成可交互架构图的生产项目。它支持架构、工作流、时序、数据流、ERD 等多种图类型，并输出带主题切换、缩放、搜索和导出的独立 HTML。

本站用它生成了 LiteLLM Proxy 架构总览：

- 从客户端、鉴权、Router、`acompletion` 到厂商翻译和 PostgreSQL
- 节点可点击、可搜索、可缩放，支持浅色 / 深色主题
- 与课程正文互相链接，作为模块 1、2 的全局地图
- 同样是独立静态页，部署时和课程放在同一目录

## 技术栈

- **Astro 7**：静态站点生成、Content Collections、Zod 校验
- **Pagefind 1.5**：构建时生成搜索索引
- **giscus**：基于 GitHub Discussions 的评论
- **Vitest + Playwright**：单元测试与 E2E
- **GitHub Actions**：构建后同时发布 GitHub Pages 和自建服务器
- **Noto Serif SC**：自托管中文正文衬线字体
- **codebase-to-course / Archify**：项目课程与架构图的生产工具链

## 本地开发

要求 Node.js 22+ 和 pnpm 12+。

```bash
git clone https://github.com/PenglongHuang/awesome-architecture-blog.git
cd awesome-architecture-blog
pnpm install
pnpm dev
```

打开：

```text
http://localhost:4321/awesome-architecture-blog/
```

默认 base path 是 `/awesome-architecture-blog/`。如果本地路径不同，可以通过 `BASE_PATH` 覆盖：

```bash
BASE_PATH=/ pnpm dev
```

### 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建站点并生成 Pagefind 索引 |
| `pnpm preview` | 预览构建产物 |
| `pnpm validate` | 校验 80 篇文章、系列和链接 |
| `pnpm test` | 运行 Vitest 单元测试 |
| `pnpm test:e2e` | 构建并运行 Playwright E2E |
| `pnpm import` | 从上游 VitePress 内容重新导入文章 |
| `pnpm import:course` | 同步 LiteLLM 课程 HTML |
| `pnpm deploy:server` | 手动构建并 rsync 到自建服务器 |

首次运行 E2E 前如缺少浏览器：

```bash
pnpm exec playwright install chromium
```

## 目录结构

```text
src/
├── content/posts/              # 80 篇 Markdown（tutorial / templates / cases）
├── content.config.ts           # 内容集合与 frontmatter schema
├── data/
│   ├── series.json             # 14 个系列的定义与匹配规则
│   ├── series.ts               # 频道配置
│   └── courses.ts              # 课程元数据、方向/形式/难度与标签注册表
├── pages/                      # 路由与页面
├── components/
│   ├── CourseCard.astro        # 课程卡片
│   └── CourseTagButton.astro   # 可筛选标签按钮
├── lib/
│   └── course-filter.ts        # 课程筛选纯函数
├── scripts/                    # 主题、Quiz、课程筛选等浏览器脚本
├── layouts/BaseLayout.astro
├── plugins/                    # Markdown 编译插件
└── styles/                     # 设计令牌与全局样式

public/learning/litellm/
├── index.html                  # LiteLLM 交互课程（静态 HTML）
└── architecture.html           # LiteLLM 可交互架构总览

scripts/                        # 内容导入、课程导入、内容校验
tests/                          # 单元测试与 E2E
```

## 写一篇文章

在 `src/content/posts/` 对应频道下新建 Markdown：

```yaml
---
title: "文章标题"
description: "一句话说明这篇讲什么"
series: foundations       # 必须是 src/data/series.json 中的 id
order: 10                 # 在系列内的顺序
pubDate: 2026-10-20
kind: tutorial            # tutorial | template | case
tags: ["入门篇", "架构思维"]
---
```

约定：

- `kind` 决定路由频道：`tutorial` → `/tutorial/`，`template` → `/templates/`，`case` → `/cases/`
- 文章 slug 取自文件名：`why-architecture-first.md` → `/tutorial/why-architecture-first/`
- `series` 必须存在于 `src/data/series.json`，否则构建和 `pnpm validate` 会失败
- 内部链接写相对 `.md` 路径即可，`remark-base-links` 会在构建时重写
- 代码块、表格、ASCII 图和 `quiz` / `decision` 代码块会由对应插件处理

新增系列时，在 `src/data/series.json` 增加一项：

```json
{
  "id": "my-series",
  "channel": "tutorial",
  "title": "系列名称",
  "description": "系列说明",
  "order": 9,
  "match": "^tutorial/my-series-"
}
```

然后运行：

```bash
pnpm validate
pnpm build
```

## 新增项目课程

1. 用 [codebase-to-course](https://github.com/zarazhangrui/codebase-to-course) 从真实代码库生成课程目录
2. 用 [Archify](https://github.com/tt-a1i/archify) 生成与课程配套的架构图
3. 把课程 HTML 放到 `public/learning/<slug>/index.html`
4. 把架构图放到同目录，例如 `public/learning/<slug>/architecture.html`
5. 在课程页中加入架构图入口，并在 `src/data/courses.ts` 增加课程元数据
6. 在 `astro.config.mjs` 的 sitemap `customPages` 中加入课程 URL
7. 课程正文建议加 `data-pagefind-body`，让 Pagefind 只索引正文
8. 不要依赖 Google Fonts 等远程字体；课程与架构图应尽量自包含

课程元数据分为四个维度（前三项使用受控词表）：

| 字段 | 作用 | 取值 |
|---|---|---|
| `track` | 一级方向，决定筛选 tab | `ai-infra` / `classic-systems` / `engineering` |
| `format` | 课程形式，显示在卡片上 | `source-walkthrough` / `case-study` / `lab` |
| `level` | 难度，显示在卡片元信息里 | `beginner` / `intermediate` / `advanced` |
| `tags` | 细分主题，可点击筛选 | `COURSE_TAGS` 中的标签 id，每门课 2–5 个 |

标签用注册表管理（`src/data/courses.ts` 中的 `COURSE_TAGS`），每个标签包含 `id`、`label`、`group`、`order` 和 `aliases`。课程只引用 `id`，显示时再取 `label`；这样改展示名不会破坏 URL，旧的中文标签 URL 也会通过 `label` / `aliases` 自动规范化。

`/learning/` 会自动生成方向与标签筛选：方向单选，标签可多选，多选时命中任一标签即可。选中的标签会固定到「标签」行前部并带关闭按钮；标签超过 8 个时，未选中的标签收进按分组展示的「更多标签」。筛选状态会同步到 URL，例如 `?track=ai-infra&tag=ai-gateway&tag=rate-limiting`。筛选是渐进增强的：脚本不可用时筛选栏隐藏，所有课程仍然可见。

LiteLLM 课程 HTML 由脚本从外部课程目录同步：

```bash
pnpm import:course
# 或指定课程根目录
pnpm import:course -- "D:/path/to/courses"
```

脚本会把课程 HTML 复制到 `public/learning/litellm/index.html`，并做几处站点化处理：注入返回链接、设置 Pagefind 索引范围、替换本地仓库路径、移除 Google Fonts。架构图作为独立的 `architecture.html` 放在同一目录，由课程页直接链接。

## 搜索与评论

### Pagefind

`pnpm build` 会在 `dist/_pagefind/` 生成静态索引。只有带 `data-pagefind-body` 的页面会进入索引，构建参数排除了 `pre,figure`，避免代码和图表污染搜索结果。

### giscus

评论配置在 `src/components/Comments.astro`，需要两个环境变量（GitHub Actions 中配置为仓库 Variables）：

```text
PUBLIC_GISCUS_REPO_ID
PUBLIC_GISCUS_CATEGORY_ID
```

仓库需要开启 Discussions，并创建一个用于评论的 category（当前使用 `Announcements`）。

## 部署

推送到 `main` 会触发 `.github/workflows/deploy.yml`：

```text
push main
  └─ build
      ├─ pnpm validate
      ├─ pnpm test
      ├─ pnpm build
      ├─ deploy → GitHub Pages
      └─ rsync → 自建服务器
```

### GitHub Pages

仓库 Settings → Pages → Source 选择 **GitHub Actions**。

### 自建服务器

部署 job 通过 rsync 推送构建产物，需要配置以下仓库 Secrets：

| Secret | 说明 |
|---|---|
| `SSH_PRIVATE_KEY` | 部署用户私钥 |
| `SSH_KNOWN_HOSTS` | 服务器 host key |
| `SSH_HOST` | 服务器地址 |
| `SSH_USER` | 部署用户 |
| `SSH_PORT` | SSH 端口 |
| `DEPLOY_PATH` | 服务器目标目录 |

也可以手动部署：

```bash
pnpm deploy:server
```

手动脚本默认使用 `~/.ssh/aa_deploy`，可通过 `AA_DEPLOY_KEY`、`AA_DEPLOY_HOST`、`AA_DEPLOY_USER`、`AA_DEPLOY_PATH` 覆盖。

### 路径与 canonical

`astro.config.mjs` 支持：

- `BASE_PATH`：站点 base，默认 `/awesome-architecture-blog/`
- `SITE_URL`：站点绝对地址
- `PUBLIC_CANONICAL_BASE` / `PUBLIC_CANONICAL_SITE`：为镜像站覆盖 canonical 地址

## 相关项目与许可

### 内容生产项目

- **[codebase-to-course](https://github.com/zarazhangrui/codebase-to-course)**：把代码库变成自包含的交互式 HTML 课程。本站 LiteLLM 课程由它生成。
- **[Archify](https://github.com/tt-a1i/archify)**：把系统结构渲染成可交互架构图，MIT 许可。本站 LiteLLM 架构总览由它生成。

### 来源与许可

站点内容整理自 [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture)，原作者为 JingWen Fan（study8677），采用 MIT 许可。转载、再发布时请保留原始版权声明。

- 原始内容许可文本见仓库根目录 [`LICENSE`](./LICENSE)
- Archify 的许可与第三方品牌标记说明见其[仓库](https://github.com/tt-a1i/archify)
- 中文字体使用 Noto Serif SC，遵循 SIL Open Font License
