# Awesome Architecture 博客站 · 设计文档

- 日期:2026-10-17
- 状态:已与用户逐节确认
- 实现仓库:`D:\hpl\projects\architect\awesome-architecture-blog`
- 线上目标:`https://penglonghuang.github.io/awesome-architecture-blog/`

---

## 1. 背景与目标

`study8677/awesome-architecture` 是一个 VitePress 文档站,含 40 章教程、31 个真实系统架构模板、6 个端到端案例(中文,另有 `en/` 镜像)。用户希望:

1. 把这批内容变成一个**自己的 Astro 博客**,而不是继续做文档站;
2. 视觉风格独特,延续内容本身「以图说话」的表达方式(ASCII 架构图、DAG、对比表是主角);
3. 部署到用户自己的 GitHub(PenglongHuang);
4. 所有需求点与决策事先对齐。

### 1.1 成功标准

- 80 篇正文全部上线,115 个 Quiz 与 1 个 DecisionCard 可交互;
- 内部链接 0 死链(构建期校验);
- 纸本杂志视觉在浅色/深色、桌面/移动端都成立;
- 搜索、深色模式、RSS、评论四项功能可用;
- main 分支推送即自动部署,PR 自动校验。

### 1.2 范围外(YAGNI)

- 英文内容(`en/`)不上站,不做 i18n;
- 不做自动上游同步(submodule / 构建期拉取);
- 不做评论审核后台、不做分析统计、不做自定义域名;
- 不引入 Vue/React 等前端框架;
- 不做内容编辑后台。

---

## 2. 已确认决策

| 决策点 | 结论 |
|---|---|
| 站点骨架 | **系列式博客**:频道 → 系列 → 文章,保留编号与上下篇 |
| 内容范围 | **中文全量**,80 篇正文 |
| 视觉方向 | **纸本杂志(Editorial)**:米白纸、衬线大字、朱红细节、ASCII 图当插图 |
| 内容进入方式 | **快照 + 可重跑的导入脚本**(方案 1) |
| 时间处理 | **手动编排时间线**,规则化生成:系列顺序 = 时间顺序 |
| 集合模型 | 单一 `posts` 集合 + `series` 字段 |
| 样式方案 | 手写 CSS + design tokens,不用 Tailwind |
| 交互实现 | 原生 JS + remark 插件,零前端框架 |
| 功能 | 站内搜索、深色模式、RSS、giscus 评论 |
| 部署 | 新公开仓库 `awesome-architecture-blog` + GitHub Pages(Actions) |

---

## 3. 信息架构

### 3.1 三层结构

**频道(3)→ 系列(14)→ 文章(80)**

| 频道 | 系列 id | 中文名 | 篇数 |
|---|---|---|---|
| tutorial | `foundations` | 入门篇 01–09 | 9 |
| tutorial | `advanced` | 进阶篇 10–17 | 8 |
| tutorial | `practice` | 实战篇 18–22 | 5 |
| tutorial | `ai-collaboration` | AI 协同篇 23–26 | 4 |
| tutorial | `stack-selection` | 技术栈选型篇 27–34 | 8 |
| tutorial | `ai-native-org` | AI 原生组织篇 35–40 | 6 |
| tutorial | `model-training` | 基础模型训练决策专题 T01 | 1 |
| tutorial | `appendix` | 附录(术语表 / 演进触发信号) | 2 |
| templates | `classic-systems` | 经典 / 通用系统 | 16 |
| templates | `ai-native-systems` | AI 原生系统 | 5 |
| templates | `coding-agents` | AI 编码 / 自治 Agent | 4 |
| templates | `system-prompts` | 系统提示词架构 | 1 |
| templates | `industrial-embedded` | 工业 / 嵌入式 | 5 |
| cases | `cases` | 案例篇 | 6 |

合计 **80 篇**。

### 3.2 URL 规则

```
/                                 首页
/tutorial/                        教程频道页(8 个系列)
/tutorial/foundations/            系列页
/tutorial/why-architecture-first/ 文章页
/templates/                       架构地图频道页(5 个系列)
/templates/classic-systems/       系列页
/templates/ai-gateway/            文章页
/cases/                           案例频道页 = 案例系列页
/cases/stararena-ticketing/       文章页
/search/  /about/  /rss.xml  /404
```

规则:

- 文章 URL 为 `/<channel>/<slug>/`;
- 系列页为 `/<channel>/<series-id>/`,唯一例外:`cases` 系列的系列页就是 `/cases/`(避免 `/cases/cases/`);
- **slug 不得与任何 series-id 相同**(验证脚本强制);
- slug 全部为英文小写、连字符分隔。

### 3.3 教程 slug 表(43 条,人工定稿)

| 源文件前缀 | slug |
|---|---|
| 01-为什么先有架构思维 | `why-architecture-first` |
| 02-架构师的思考框架 | `architects-thinking-framework` |
| 03-读懂与画好架构图 | `reading-and-drawing-diagrams` |
| 04-十大核心架构模式 | `ten-core-patterns` |
| 05-数据与状态 | `data-and-state` |
| 06-质量属性与取舍 | `quality-attributes-and-tradeoffs` |
| 07-从0到1设计一个系统 | `designing-from-zero-to-one` |
| 08-架构决策记录与演进 | `adr-and-evolution` |
| 09-架构品味 | `architectural-taste` |
| 10-分布式系统的硬道理 | `hard-truths-of-distributed-systems` |
| 11-数据一致性工程 | `data-consistency-engineering` |
| 12-为失败而设计 | `designing-for-failure` |
| 13-规模化的力学 | `mechanics-of-scale` |
| 14-演进与拆分大型系统 | `evolving-and-splitting-large-systems` |
| 15-组织即架构 | `organization-as-architecture` |
| 16-安全与多租户架构 | `security-and-multi-tenancy` |
| 17-大模型时代的架构判断 | `architecture-judgment-in-llm-era` |
| 18-读地图用框架拆解陌生系统 | `deconstructing-unfamiliar-systems` |
| 19-完整设计演练中等复杂度系统 | `full-design-walkthrough` |
| 20-演进剧本MVP到规模化 | `evolution-playbook-mvp-to-scale` |
| 21-拆分与迁移实战 | `splitting-and-migration-in-practice` |
| 22-AI原生系统设计 | `ai-native-system-design` |
| 23-规格即架构约束怎么写给AI | `spec-as-architecture` |
| 24-审查清单AI产出默认缺什么 | `review-checklist-for-ai-output` |
| 25-评测驱动把够好写进架构 | `eval-driven-architecture` |
| 26-协作决策树何时vibe何时spec-first | `when-to-vibe-when-to-spec` |
| 27-编程语言与后端框架选型 | `languages-and-backend-frameworks` |
| 28-数据库与存储选型 | `databases-and-storage` |
| 29-缓存消息队列与事件系统选型 | `cache-queues-and-events` |
| 30-API与服务通信选型 | `apis-and-service-communication` |
| 31-云原生与部署平台选型 | `cloud-native-and-deployment` |
| 32-可观测性与可靠性技术栈选型 | `observability-and-reliability` |
| 33-AI基础设施技术栈选型 | `ai-infrastructure` |
| 34-技术选型决策树 | `technology-selection-decision-tree` |
| 35-AI原生组织架构 | `ai-native-organization` |
| 36-超级个体与超级团队 | `super-individuals-and-teams` |
| 37-共享上下文架构 | `shared-context-architecture` |
| 38-AI工作流架构 | `ai-workflow-architecture` |
| 39-责任与治理架构 | `responsibility-and-governance` |
| 40-AI原生组织演进路线 | `ai-native-organization-roadmap` |
| T01-训练方案不是算法排行榜先把决策分层 | `training-plan-decision-layers` |
| 术语表 | `glossary` |
| 演进触发信号 | `evolution-trigger-signals` |

**模板 slug = 源目录名**(`ai-gateway`、`claude-code`、`robotics` …),**案例 slug = 源目录名**(`stararena-ticketing` …),均为现成英文,无需映射。

### 3.4 时间线规则

- 起点:`2026-01-06`(周二);节奏:每周二、周五各一篇;
- 顺序:先按系列定义的顺序、再按系列内 `order`;
- 公式:第 n 篇的 `w = floor((n-1)/2)`,日期 = 起点 + 7w 天,`(n-1)` 为奇数再加 3 天(周五);
- 结果区间:教程 2026-01-06 → 2026-06-02,模板 2026-06-05 → 2026-09-18,案例 2026-09-22 → 2026-10-09;
- 规则写死在导入脚本中,重跑结果完全一致;整体平移只需改一个常量。

---

## 4. 内容迁移

### 4.1 导入脚本 `scripts/import-content.mjs`

输入:源仓库 `tutorial/`、`templates/`、`cases/` 下 85 个 `.md`。
输出:`src/content/posts/**` 80 篇 + 一份迁移报告。

五步:

1. **扫描与筛选**:排除 `tutorial/README.md`、`templates/README.md`、`cases/README.md`、`templates/_TEMPLATE.md`、`templates/ai-native-organization/README.md`(专题索引,非文章,内容并入频道页)。
2. **元数据提取**:取首个 H1 为 `title`;取 H1 之后的首个引用块为 `description`;从正文移除 H1(版式负责渲染标题)。缺 H1 → 非零退出。
3. **链接改写**:解析每条相对链接,相对源文件路径做 POSIX 归一化,再查 `源路径 → 路由` 映射表;保留 `#anchor` 与查询串;外链不动;无法映射 → 非零退出并列出。
4. **组件转换**:`<Quiz … />` → `:::quiz {json} :::`;`<DecisionCard … />` → `:::decision {json} :::`。解析 Vue 属性(`:options="[...]"` 以受限 JS 字面量解析,只接受字符串/数字/布尔数组,拒绝任意代码)。
5. **写入与校验**:按 `<channel>/<slug>.md` 写入,frontmatter 按 4.2 生成;输出迁移报告 `scripts/import-report.json`(篇数、Quiz/Decision 数、改写链接数、含 CJK 的 `pre` 清单、未映射清单)。

**幂等**:输出按固定顺序生成,不含时间戳;同一输入重跑产生逐字节相同的结果。

### 4.2 Frontmatter schema

```yaml
title: 为什么先有架构思维
description: 写代码这件事正在我们眼前消失……
series: foundations
order: 1
pubDate: 2026-01-06
kind: tutorial          # tutorial | template | case
tags: [架构思维, 基本功]
```

`tags` 的初版规则(确定性):`[系列中文名, kind 对应的中文类名]`,例如「入门篇」系列为 `["入门篇", "教程"]`;人工调整只改产物文件,不回写脚本。

### 4.3 链接映射表

| 源 | 目标 |
|---|---|
| `tutorial/<file>.md` | `/tutorial/<slug>/` |
| `tutorial/README.md` | `/tutorial/` |
| `templates/<name>/README.md` | `/templates/<name>/` |
| `templates/README.md` | `/templates/` |
| `templates/_TEMPLATE.md` | 去掉链接,保留文字 |
| `cases/<name>/README.md` | `/cases/<name>/` |
| `cases/README.md` | `/cases/` |
| `tutorial/术语表.md` / `演进触发信号.md` | `/tutorial/<slug>/` |

同目录链接(如 `08-架构决策记录与演进.md`)先按源文件目录拼接再查表。

### 4.4 Quiz 处理

- 导入产物:`:::quiz {"question":"…","options":["…"],"answer":1,"explanation":"…"} :::`
- `src/plugins/remark-quiz.mjs`:识别 `quiz` / `decision` 指令,解析 JSON,生成 `<Quiz />` / `<DecisionCard />` 节点;
- JSON 非法 → 构建失败;
- 组件行为:点选 → 高亮;确认 → 判分并展开解析;可重置;键盘可达(`button` + `aria-pressed`);无持久化;
- 不使用 MDX:`.md` 中的 ASCII 图含大量 `<`/`>`,MDX 解析风险高。

### 4.5 已知内容问题与处理

- **ASCII 图中的 CJK 字符可能破坏等宽对齐**:导入报告标记「含 CJK 的 `pre`」,实现阶段逐张目检;必要时把图内中文改为英文缩写。
- **`templates/ai-native-organization/README.md`** 是专题索引,不单独成文;其内容摘要并入 `/templates/` 频道页。
- 源内容中的「参考原型」外链全部保留,不做外链可用性校验。

---

## 5. 视觉系统

### 5.1 Design tokens

```css
:root {
  --paper:  #f6f2ea;
  --ink:    #1a1814;
  --muted:  #6b6459;
  --accent: #b03a2e;
  --rule:   #d8d0c0;
  --code-bg:#efe9dd;
  --soft:   #f0e8d8;

  --font-serif: "Noto Serif SC", "Songti SC", "Source Han Serif SC", Georgia, serif;
  --font-mono:  "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  --measure: 38em;
}

[data-theme="dark"] {
  --paper:  #161513;
  --ink:    #e7e0d3;
  --muted:  #9a9284;
  --accent: #d96a56;
  --rule:   #2e2a24;
  --code-bg:#1f1d19;
  --soft:   #221f1a;
}
```

### 5.2 排版

| 元素 | 规格 |
|---|---|
| 首页主标题 | 52px / 1.18,字重 400 |
| 文章标题 | 40px / 1.25,字重 400 |
| 正文 | 16px / 1.95,栏宽 `--measure` |
| H2 | 21px,前置 9px 朱红方块 |
| 元信息/标签 | 11–12px,`letter-spacing .08–.28em` |
| ASCII 图 | 12.5px / 1.55,等宽,横向滚动 |

字体:自托管 `@fontsource/noto-serif-sc` 400/600(unicode-range 分片),`font-display: swap`;等宽用系统栈。

朱红只用于:系列编号、图注、关键分隔与强调;链接使用墨色 + 下划线,不用朱红。

### 5.3 页面模板

1. **首页** `/`:刊头 → Hero(标题/导语/起点 CTA)→ 学习路径(14 系列卡片)→ 最近更新(时间线前 6 篇)→ 页脚。
2. **频道页** `/tutorial/` `/templates/`:系列卡片网格 + 该频道最近更新。
3. **系列页**:系列名、简介、篇数、按 `order` 的文章列表(编号 + 标题 + 摘要),上/下系列。
4. **文章页**:面包屑 → 标题 → 导语 → 元信息(日期/时长/系列序号)→ 正文 + 右侧粘性目录 → Quiz → 同系列上下篇 → 评论。
5. **搜索页** `/search/`:输入框 + 结果列表,空态提示;`Ctrl/Cmd+K` 唤起。
6. **404**:纸本风格,提供回首页/教程入口。

移动端:单列,目录折叠到正文上方,ASCII 图横向滚动。

### 5.4 深色模式

- `<html data-theme>` 切换;`<head>` 内联脚本在读 `localStorage.theme` 或 `prefers-color-scheme` 后立即设置,避免闪烁;
- masthead 提供切换按钮,写入 localStorage;
- giscus 通过 `postMessage` 跟随主题。

---

## 6. 技术架构

### 6.1 技术栈

- Astro 最新稳定版(实现时 `npm view astro version` 锁定)
- TypeScript strict
- Astro Content Collections + `glob` loader
- 原生 JS(Quiz、主题、搜索 UI)
- Vitest(单元测试)+ Playwright(E2E 冒烟)
- Pagefind(构建后索引)
- pnpm(`packageManager` 字段固定版本),Node 22

### 6.2 目录结构

```
awesome-architecture-blog/
├── astro.config.mjs
├── package.json
├── scripts/
│   ├── import-content.mjs
│   ├── slugs.json
│   └── validate-content.mjs
├── src/
│   ├── content.config.ts
│   ├── data/series.ts
│   ├── content/posts/{tutorial,templates,cases}/
│   ├── plugins/remark-quiz.mjs
│   ├── layouts/{BaseLayout,PostLayout}.astro
│   ├── components/
│   │   ├── Masthead.astro      SeriesCard.astro    PostList.astro
│   │   ├── Toc.astro           Figure.astro        Quiz.astro
│   │   ├── DecisionCard.astro  Comments.astro      Footer.astro
│   ├── pages/
│   │   ├── index.astro         about.astro         search.astro
│   │   ├── rss.xml.ts          404.astro
│   │   ├── tutorial/index.astro
│   │   ├── tutorial/[...path].astro
│   │   ├── templates/index.astro
│   │   ├── templates/[...path].astro
│   │   ├── cases/index.astro
│   │   └── cases/[...path].astro
│   └── styles/{tokens.css,global.css}
├── public/{.nojekyll,favicon.svg,og-default.png}
├── tests/{unit,e2e}/
└── .github/workflows/{ci.yml,deploy.yml}
```

**路由说明**:每个频道使用一个 `[...path].astro` catch-all,在同一文件内用 `getStaticPaths` 同时产出系列页与文章页,避免 `[slug]` 与 `[series]/index` 的路由优先级歧义。解析顺序:匹配 series-id → 系列页;否则按 slug 查文章 → 404。

### 6.3 内容集合

```ts
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    series: z.enum([...14 个 id]),
    order: z.number().int().positive(),
    pubDate: z.coerce.date(),
    kind: z.enum(['tutorial', 'template', 'case']),
    tags: z.array(z.string()).default([]),
  }),
})
```

### 6.4 四项功能

| 功能 | 实现 |
|---|---|
| 深色模式 | 内联 head 脚本 + `data-theme` + CSS 变量 + localStorage |
| 搜索 | 构建后 `pagefind --site dist`;自定义 UI 调用 Pagefind JS API;中文检索效果受限于分词,空态给提示 |
| RSS | `@astrojs/rss`,`/rss.xml`,80 篇按 `pubDate` 倒序 |
| 评论 | giscus,`data-mapping="pathname"`,主题跟随;依赖公开仓库 + Discussions + giscus App |

### 6.5 错误处理与校验

`scripts/validate-content.mjs` 在 CI 与本地构建前执行,任一失败即非零退出:

1. frontmatter 字段完整、类型正确;
2. `series` 属于 14 个合法 id;
3. 同系列 `order` 唯一且从 1 连续;
4. 频道内 slug 唯一,且不与任何 series-id 冲突;
5. 同系列 `pubDate` 随 `order` 严格递增;
6. 正文中不残留 `](...md)` 内部链接;
7. 所有内部链接能解析到已生成路由;
8. Quiz/Decision JSON 可解析,`answer` 在选项范围内;
9. 正文非空。

导入脚本对未映射链接、缺 H1、非法 Quiz 一律**响亮失败**,不做静默跳过。

### 6.6 测试

| 层 | 工具 | 覆盖 |
|---|---|---|
| 单元 | Vitest | `rewriteLink`、`resolveRelative`、`extractTitle`、`extractDescription`、`parseQuizAttributes`、日期生成 |
| 集成 | `validate-content.mjs` | 80 篇全量内容校验 |
| E2E | Playwright | 首页 → 系列 → 文章;Quiz 点选判分;主题切换持久化;搜索出结果 |

目标覆盖率:导入脚本与验证逻辑 ≥ 80%;页面模板不做快照测试。

### 6.7 性能预算

- 首屏 JS ≤ 30KB(不含 giscus 与 Pagefind 按需加载);
- 字体 `font-display: swap`,不阻塞 LCP;
- Lighthouse Performance ≥ 95、Accessibility ≥ 95。

---

## 7. 部署

### 7.1 流水线

```
PR  → ci.yml     install → validate → unit test → build
main→ deploy.yml install → validate → test → build → pagefind → upload → deploy-pages
```

`astro.config.mjs`:

```js
export default defineConfig({
  site: 'https://penglonghuang.github.io',
  base: '/awesome-architecture-blog/',
  integrations: [sitemap()],
})
```

- `public/.nojekyll` 必须存在;
- Pages source 设为 **GitHub Actions**;
- 回滚:重跑历史 workflow。

### 7.2 用户需完成的事项

1. 确认仓库**公开**;
2. 在网页安装 **giscus App** 并授权该仓库;
3. (可选)以后绑定自定义域名。

其余(建仓库、开启 Discussions、设置 Pages、push、首次部署)由实现方通过 `gh` 完成。

---

## 8. 署名与许可

源内容为 **MIT**,版权人 **JingWen Fan (study8677)**。MIT 允许转载,但要求保留版权声明。

- 仓库根保留原始 `LICENSE`(版权行不改);
- `/about` 设「来源与许可」区块,链回 `https://github.com/study8677/awesome-architecture`;
- 全站页脚:`内容整理自 Awesome Architecture · MIT`;
- 若用户本人为原作者/贡献者,署名可再调整,但版权声明依旧保留。

---

## 9. 验收清单

- [ ] 80/80 篇正文,115/115 Quiz,1 个 DecisionCard
- [ ] 内部链接 0 死链(构建期校验)
- [ ] 搜索 / 深色 / RSS / 评论可用
- [ ] 六套模板齐全(首页、频道页、系列页、文章页、搜索页、404)
- [ ] 浅色与深色在桌面与 390px 宽度下均无横向溢出(ASCII 图除外,其滚动容器内滚动)
- [ ] Lighthouse Performance ≥ 95、Accessibility ≥ 95
- [ ] PR 自动校验,main 自动部署
- [ ] 署名与许可区块上线

---

## 10. 实施顺序

1. 脚手架(Astro + TS + tokens + 基础版式)
2. 导入脚本 + slug 表 + 链接改写 + Quiz 转换 + 迁移报告
3. 页面模板与组件(首页/频道/系列/文章/搜索/404)
4. 四项功能
5. 单元测试 + 内容校验 + E2E 冒烟
6. CI + 首次部署
7. 内容 QA(ASCII 对齐抽检、移动端、深色、真机验证)
