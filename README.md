# AI架构师之路

> 用「纸本杂志」的方式，把架构判断力整理成一套可读、可查、可练的中文知识库。

[![Deploy](https://github.com/PenglongHuang/awesome-architecture-blog/actions/workflows/deploy.yml/badge.svg)](https://github.com/PenglongHuang/awesome-architecture-blog/actions/workflows/deploy.yml)

**线上入口：** [GitHub Pages](https://penglonghuang.github.io/awesome-architecture-blog/) · [自建镜像](http://118.196.50.229/awesome-architecture-blog/)

持续更新的中文架构知识库，包含教程、真实系统架构地图、端到端系统设计、交互式项目课程与可交互架构总览图。

## 站点内容

| 板块 | 路径 | 内容 |
|---|---|---|
| [入门教程](https://penglonghuang.github.io/awesome-architecture-blog/tutorial/) | `/tutorial/` | 从架构思维到实战的入门教程 |
| [架构地图](https://penglonghuang.github.io/awesome-architecture-blog/templates/) | `/templates/` | 真实系统的架构地图 |
| [系统设计](https://penglonghuang.github.io/awesome-architecture-blog/cases/) | `/cases/` | 端到端的系统设计推演 |
| [项目学习](https://penglonghuang.github.io/awesome-architecture-blog/learning/) | `/learning/` | 3 门交互式项目课程：LiteLLM / LLM2Jev / Pi |
| [搜索](https://penglonghuang.github.io/awesome-architecture-blog/search/) | `/search/` | Pagefind 本地静态索引 |
| [RSS](https://penglonghuang.github.io/awesome-architecture-blog/rss.xml) | `/rss.xml` | 全站文章订阅源 |

**基础模型训练决策专题 · 11 篇**：[从八个问题开始](https://penglonghuang.github.io/awesome-architecture-blog/tutorial/t01-introduction-map/)，沿合同助手教学案例，逐步写出预算、数据、训练与发布决策。带着具体问题来读，也可以从 [训练费用怎么算](https://penglonghuang.github.io/awesome-architecture-blog/tutorial/t02-scaling-budget-three-ledgers/)、[RLVR 值不值得做](https://penglonghuang.github.io/awesome-architecture-blog/tutorial/t08-rlvr-prerequisites-attribution-health/) 或 [模型何时能上线](https://penglonghuang.github.io/awesome-architecture-blog/tutorial/t10-safety-spec-evaluation-gate/) 进入。

每门项目课程除了课程正文，还配一张可交互架构总览图：

| 课程 | 课程正文 | 架构总览 |
|---|---|---|
| LiteLLM 内部漫游指南 | [课程](https://penglonghuang.github.io/awesome-architecture-blog/learning/litellm/) | [架构图](https://penglonghuang.github.io/awesome-architecture-blog/learning/litellm/architecture.html) |
| LLM2Jev 决策引擎拆解 | [课程](https://penglonghuang.github.io/awesome-architecture-blog/learning/llm2jev/) | [架构图](https://penglonghuang.github.io/awesome-architecture-blog/learning/llm2jev/architecture.html) |
| Pi 编码代理内部探秘 | [课程](https://penglonghuang.github.io/awesome-architecture-blog/learning/pi/) | [架构图](https://penglonghuang.github.io/awesome-architecture-blog/learning/pi/architecture.html) |

站点是纯静态的多页应用（MPA），没有数据库和前端框架运行时：

- 内容构建时编译为 HTML
- 搜索由 Pagefind 在浏览器本地用 WASM 完成
- 评论由 giscus 承载，数据存在 GitHub Discussions
- 主题、Quiz、课程筛选、目录等交互使用少量原生 JS；主题提供明亮 / 暗黑 / 羊皮纸 / 护眼绿 / 纯白五种风格，由站点与课程页共用的 `public/theme.css` + `public/theme.js` 承载

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
| 文章整理 | [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture) | `src/content/posts/` 下的 Markdown 文章 |
| 项目课程 | [codebase-to-course](https://github.com/zarazhangrui/codebase-to-course) 与仓库内静态课程页 | 3 门课程：LiteLLM / LLM2Jev / Pi |
| 架构图 | [Archify](https://github.com/tt-a1i/archify) | 与三门课程配套的可交互架构图 |
| 站点构建 | Astro + Pagefind | GitHub Pages 与自建 Nginx 镜像 |

### codebase-to-course

[codebase-to-course](https://github.com/zarazhangrui/codebase-to-course) 是一个把代码库变成交互式 HTML 课程的生产项目。它面向不写代码、但需要理解系统的读者，把源码、数据流和概念拆成可滚动阅读的模块。

本站用它生成了 LiteLLM 课程：

- 8 个模块，围绕一次 `/v1/chat/completions` 请求展开
- 包含代码与中文解释并排、Quiz、术语提示和数据流动画
- 课程是自包含的独立 HTML，不进入 Astro 组件树
- 课程入口由 `/learning/` 统一索引、分类和筛选

LLM2Jev 与 Pi 两门课程则以静态课程页的形式直接维护在 `public/learning/` 下，阅读体验与 LiteLLM 课程一致：可滚动模块、代码与解释并排、Quiz 与数据流动画。

### Archify

[Archify](https://github.com/tt-a1i/archify) 是一个把系统结构渲染成可交互架构图的生产项目。它支持架构、工作流、时序、数据流、ERD 等多种图类型，并输出带主题切换、缩放、搜索和导出的独立 HTML。

本站用它为三门课程各生成了一张可交互架构总览：

- [LiteLLM Proxy 架构总览](https://penglonghuang.github.io/awesome-architecture-blog/learning/litellm/architecture.html)：从客户端、鉴权、Router、`acompletion` 到厂商翻译和 PostgreSQL
- [LLM2Jev 决策架构总览](https://penglonghuang.github.io/awesome-architecture-blog/learning/llm2jev/architecture.html)：从 systemone 请求到二值打分、三后端与前缀缓存
- [Pi 内部探秘架构总览](https://penglonghuang.github.io/awesome-architecture-blog/learning/pi/architecture.html)：从终端回车到代理循环、模型运行时与上下文压缩
- 节点可点击、可搜索、可缩放，支持浅色 / 深色主题
- 与对应课程正文互相链接，作为课程的全局地图
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
| `pnpm validate` | 校验文章、系列、链接与 SEO 元数据 |
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
├── content/posts/              # Markdown 文章（tutorial / templates / cases）
├── content.config.ts           # 内容集合与 frontmatter schema
├── data/
│   ├── series.json             # 14 个系列的定义与匹配规则
│   ├── series.ts               # 频道配置
│   └── courses.ts              # 3 门课程的元数据、方向/形式/难度与标签注册表
├── pages/                      # 路由与页面（含 RSS、about、404）
├── components/
│   ├── Masthead.astro          # 顶部导航与主题切换
│   ├── CourseCard.astro        # 课程卡片
│   ├── CourseTagButton.astro   # 可筛选标签按钮
│   └── …                       # 文章列表、目录、页脚、giscus 评论等
├── lib/                        # 课程筛选、文章集合、阅读时长等纯函数
├── scripts/                    # 主题、导航、Quiz、阅读进度、课程筛选等浏览器脚本
├── layouts/BaseLayout.astro
├── plugins/                    # Markdown 编译插件
└── styles/                     # 设计令牌与全局样式

public/learning/                # 交互式项目课程，每门一个目录
├── litellm/                    # LiteLLM 课程 + architecture.html
├── llm2jev/                    # LLM2Jev 课程 + architecture.html
├── pi/                         # Pi 课程 + architecture.html
└── reading-room.css            # 课程页共用的阅读样式

scripts/                        # 内容导入、课程导入、内容校验、部署脚本与构建垫片
tests/                          # 单元测试与 E2E
```

## 内容开发指南

新增文章、专题、架构地图或项目课程时，按 [内容开发指南](docs/content-authoring.md) 同步更新站点结构、SEO 元数据与 GEO 内容要素。

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

Pull request 则由 `.github/workflows/ci.yml` 运行同样的 `validate / test / build` 校验。

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

canonical 覆盖由 `src/layouts/BaseLayout.astro` 读取，用于镜像站：

- `PUBLIC_CANONICAL_BASE` / `PUBLIC_CANONICAL_SITE`：覆盖 canonical 的 base 与站点地址

## 相关项目与许可

### 内容生产项目

- **[codebase-to-course](https://github.com/zarazhangrui/codebase-to-course)**：把代码库变成自包含的交互式 HTML 课程。本站 LiteLLM 课程由它生成。
- **[Archify](https://github.com/tt-a1i/archify)**：把系统结构渲染成可交互架构图，MIT 许可。本站 LiteLLM 架构总览由它生成。

### 来源与许可

站点内容整理自 [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture)，原作者为 JingWen Fan（study8677），采用 MIT 许可。转载、再发布时请保留原始版权声明。

- 原始内容许可文本见仓库根目录 [`LICENSE`](./LICENSE)
- Archify 的许可与第三方品牌标记说明见其[仓库](https://github.com/tt-a1i/archify)
- 中文字体使用 Noto Serif SC，遵循 SIL Open Font License
