# 内容开发指南

只记住一条原则：**内容文件负责知识，系列配置负责组织，页面模板负责 SEO，文章本身负责 GEO。**

## 新增一篇文章

1. 在 `src/content/posts/<频道>/` 新建 Markdown：`tutorial`、`templates` 或 `cases`。
2. 填 Frontmatter：

```yaml
---
title: "一个具体、可搜索的问题"
description: "用一两句话说明本文回答什么问题、提供什么价值。"
series: my-series
order: 1
pubDate: 2026-11-10
# 内容发生实质更新时才填写；不要为了显得新而改日期
updatedDate: 2026-11-12
author: "实际作者"
editor: "实际编辑者"
kind: tutorial
tags: ["Agent", "评测"]
# 可选：图片放 public/ 下，路径相对 public/，必须同时写 coverAlt
cover: "covers/my-article.png"
coverAlt: "展示文章核心架构的数据流图"
---
```

3. 文件名就是 URL slug；发布后保持稳定，不要随意改名。
4. 内部 Markdown 链接写相对 `.md` 路径；构建插件会转换为站内 URL。
5. 使用清晰的 H2/H3 标题；图片必须有描述性 Alt；重要事实链接到原始论文、官方文档、RFC 或源码。
6. 文章按 GEO 的「答案优先」结构写：先用一段话直接回答，再解释定义/边界、原理、架构、真实案例、失败模式、适用条件和参考来源。
7. 优先提供原创图、真实代码/数据、可复现步骤和反例；不要堆关键词，也不要把泛化的 AI 总结当作独特内容。

`author`、`editor`、`updatedDate` 和 `cover` 为可选字段；只有信息真实时才填写。设置 `cover` 时必须同时提供 `coverAlt`，本地图片必须存在于 `public/`；分享封面优先使用 1200×630 PNG/JPG。

## 新增一个专题 / 系列

1. 在 `src/data/series.json` 增加配置：

```json
{
  "id": "my-series",
  "channel": "tutorial",
  "title": "专题名称",
  "description": "专题解决什么问题、适合谁阅读。",
  "order": 10,
  "match": "^tutorial/my-series-"
}
```

2. `id` 必须唯一；`channel` 使用 `tutorial`、`templates` 或 `cases`。
3. `match` 必须匹配专题文章的相对文件路径；固定顺序可增加 `explicitOrder`。
4. `src/content.config.ts` 的系列枚举从 `series.json` 自动生成，通常不需要改。
5. 新文章的 `series` 填新 id，`order` 从 1 连续递增；同一系列的发布日期按顺序递增。
6. 系列页会自动生成文章列表、CollectionPage / ItemList 结构化数据和延伸阅读，不需要手工添加 Sitemap URL。

## 新增架构地图或系统设计案例

- 架构地图放在 `src/content/posts/templates/<slug>/README.md`，并在 `series.json` 的对应系列中更新 `explicitOrder`（如果该系列使用显式顺序）。
- 系统设计案例放在 `src/content/posts/cases/<slug>/README.md`，并更新 cases 系列的 `explicitOrder`。
- Frontmatter 的 `kind` 分别使用 `template` 或 `case`；URL 由内容路由生成。
- 架构图要有图题、Alt 或相邻文字解释；不要只放一张没有上下文的图片。

## 新增独立项目课程

独立课程位于 `public/learning/<slug>/`，不会自动继承 Astro 的 BaseLayout：

1. 增加 `index.html`；如有独立架构图，再增加 `architecture.html`。
2. 每个 HTML 页面都要有唯一的 `title`、`meta description`、绝对 `canonical`、Open Graph 和 Twitter Card 元信息。
3. 在 `src/data/courses.ts` 注册课程元数据、方向、难度和标签。
4. 在 `astro.config.mjs` 的 Sitemap `customPages` 中加入课程入口；独立架构图也要单独加入。
5. 正文使用 `data-pagefind-body`，避免导航、工具栏等 UI 污染站内搜索索引。
6. 页面应提供返回课程目录、相关文章和来源链接；尽量自包含，不依赖不稳定的远程资源。

## SEO / GEO 发布检查

- [ ] 标题准确描述一个核心问题；Description 独立、具体，不复制标题。
- [ ] 页面只有一个主 H1，H2/H3 层级清楚。
- [ ] 图片有 Alt；重要图表在正文中有文字解释。
- [ ] 重要事实有一手来源，标明版本、日期和适用条件。
- [ ] 有真实案例、代码、数据、公式、反例或设计取舍中的至少一项。
- [ ] 链接到前置知识、相关概念和后续实战；相关链接组件会按标签和系列自动推荐。
- [ ] 作者、编辑、更新时间和图片信息真实；不要虚构作者或更新时间。
- [ ] 发布后 URL 稳定；改 URL 时补充重定向或旧链接处理。

## 本地验证

```bash
pnpm validate
pnpm test
pnpm build
pnpm preview
```

预览后检查标题、Description、Canonical、OG、JSON-LD、图片 Alt、面包屑和延伸阅读。结构化数据可用 Google Rich Results Test / Schema Markup Validator 检查。

## 域名与爬虫注意事项

- `SITE_URL` 是 Astro 的正式站点 Origin；`BASE_PATH` 是部署路径。Canonical、Sitemap 和 robots.txt 必须使用同一组配置。
- 当前 GitHub Pages 是项目站点（URL 带 `/awesome-architecture-blog/`）。标准 robots.txt 位于域名根路径 `/robots.txt`，项目站点无法在 GitHub Pages 的域名根路径发布它；生成的 `/robots.txt` 只有部署到自有域名根路径或由反向代理映射到根路径时，才会被爬虫按标准位置读取。
- 自有域名上线后，将 `SITE_URL` 指向 HTTPS 主域名、`BASE_PATH=/`；若设置 `PUBLIC_CANONICAL_SITE` / `PUBLIC_CANONICAL_BASE`，必须与前两者保持一致，并同步更新独立课程 HTML 的 canonical。确保 GitHub Pages / IP 镜像跳转或 canonical 指向唯一主站。
- `OAI-SearchBot` 用于 ChatGPT 搜索发现；`GPTBot` 是独立的训练数据爬虫。当前规则允许默认抓取，若要限制训练抓取，应单独评估 GPTBot 策略，不要误伤 OAI-SearchBot。
