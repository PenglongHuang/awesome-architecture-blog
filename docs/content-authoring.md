# 内容开发指南

本站 Markdown 内容以 `src/content/posts/` 为准，直接在站内编辑和新增；日常写作不需要运行历史导入命令。

## 新增文章

在 `tutorial/`、`templates/` 或 `cases/` 下新增 Markdown，文件名即稳定的 URL slug。发布后尽量保留文件名，避免已有链接失效。

```yaml
---
title: "文章标题"
description: "说明读者的问题、文章的范围与所得。"
series: foundations
order: 1
pubDate: 2026-11-16
kind: tutorial
tags: [架构思维]
---
```

以上是字段示例；已有系列的 `order` 从 1 连续排列，新增文章使用该系列的下一个序号。日期应晚于该系列前一篇；修改已有文章时保留 `pubDate`，设置不早于它的 `updatedDate`。

- `kind` 为 `tutorial`、`template` 或 `case`，分别对应目录和频道 `tutorial`、`templates`、`cases`。
- `series` 必须来自 `src/data/series.json`，并与文章频道一致。
- 可选字段：`author`、`editor`、`updatedDate`、`cover`、`coverAlt`。设置封面时必须同时提供替代文本；本地封面放在 `public/`，路径相对此目录。
- 正文使用清晰的标题层级。内部链接使用 `/tutorial/slug/` 等站点相对路径，不写部署前缀、不链接 `.md` 文件；锚点以最终构建的标题 ID 为准。
- 对架构建议写明场景、约束、选择、取舍和验证方式；引用外部事实时附来源，避免将特定前提下的判断写成普遍结论。

## 新增系列

在 `src/data/series.json` 中加入唯一 `id`、`channel`、`title`、`description`、正整数 `order` 与有效正则 `match`。`match` 为历史导入工具使用的兼容字段，站内文章的归属由 frontmatter 的 `series` 决定。精选可设置 `featured`、`featuredOrder`、`featuredTags`。

系列 ID 与文章 slug 不能在同一频道冲突。系列 ID 和频道发布后保持稳定。

## 项目课程

`public/learning/` 的课程及架构图继续由对应 skill 的流程生成或维护，本轮不改变其结构。新增课程后维护 `src/data/courses.ts` 的元数据及分类，并在 `astro.config.mjs` 中登记课程与架构图的 sitemap 地址。单元测试会检查入口文件存在。

若使用现有 LiteLLM 导入工具，显式指定来源目录：

```sh
pnpm import:course /path/to/courses
# 或设置 COURSE_SRC
```

## 提交前验证

```sh
pnpm validate
pnpm test
pnpm check
pnpm build
pnpm check:links
E2E_SKIP_BUILD=1 pnpm test:e2e
```

链接检查覆盖 Astro 产出的站内链接、资源目标与锚点，不访问外部网站。对生成课程仅检查链接入口存在，课程内部结构仍由其生成流程负责。

## 中英文版本

中文内容按原流程维护；入门篇已有英文版，修改后需核对对应译文并更新其修订 hash。新增译文和扩展系列的规则见 [双语维护指南](i18n.md)。
