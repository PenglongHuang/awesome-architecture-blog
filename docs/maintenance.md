# 维护说明

## CI 与发布

PR 的 `.github/workflows/ci.yml` 运行在 GitHub Actions 托管的 `ubuntu-latest` runner，使用 Node 22 和 `package.json` 指定的 pnpm。两组并行任务分别验证 `/` 和 `/awesome-architecture-blog/`。

每组执行内容校验、单元测试、`astro check`、静态构建、构建链接检查，再以 Chromium 无头运行 E2E。E2E 复用本次构建，不重复构建。现有 smoke 用例覆盖导航、课程入口与返回、课程筛选和 URL 持久化、键盘操作、无 JS 降级、Quiz、主题持久化、Pagefind 搜索。元数据用例检查 canonical、OG、文章结构化数据、RSS 与 sitemap 一致性。

测试失败时上传 `playwright-report/` 和 `test-results/`，保留 7 天；CI 首次失败后的重试保留 trace。排查时下载 Actions 页面中的 artifact。

推送 `main` 或手动触发 Deploy 时，对配置的实际部署路径运行同一套检查。全部通过后才上传产物并发布至 Pages 和服务器。检查失败不会开始这两个发布任务。

## 地址配置

`src/lib/site-urls.mjs` 是纯函数地址模块；`src/lib/urls.ts` 为 Astro 页面绑定环境变量。

- `SITE_URL` 为实际 HTTP(S) origin，不含路径；默认 `https://penglonghuang.github.io`。
- `BASE_PATH` 为实际部署前缀，默认 `/awesome-architecture-blog/`；根路径显式设置 `/`。
- `PUBLIC_CANONICAL_SITE` 和 `PUBLIC_CANONICAL_BASE` 可单独覆盖规范地址，未提供的部分沿用实际部署配置。
- 页面路径在传入 canonical 函数前无需手工删除部署前缀；函数仅在开头完整匹配前缀时移除一次。
- `public/learning/` 是生成页面，未改动其内嵌元数据。统一地址模块适用于 Astro 页面及其站点级输出。

本地运行根路径检查时，将 `BASE_PATH=/` 同时用于构建、链接检查和 E2E。

## 构建依赖

保留 pnpm 锁文件并用 `pnpm install --frozen-lockfile` 安装。升级依赖时一起提交 manifest 和锁文件，并运行上述完整检查。

旧的 picomatch、yaml、eventemitter3 ESM 垫片已移除。当前锁定的 Astro 7.4.12 / Vite 8.3.8 在 Node 22 下可直接构建，锁文件中已不包含 eventemitter3；测试直接使用已声明的 yaml 依赖。无需再维护打包副本，也不再从 pnpm 内部目录猜测版本。以后只有在明确复现上游兼容故障时才引入新的临时兼容层，并记录对应版本、问题和移除条件。

## 样式位置

`src/styles/global.css` 只组织导入；文件顺序保持原有层叠关系：基础 → 站点外壳 → 首页 → 集合页 → 课程目录 → 文章及练习 → 搜索等次级页面 → 响应式覆盖。设计令牌仍在 `tokens.css`，共享主题仍在 `public/theme.css`。跨页面响应式规则集中在 `responsive.css`，避免遗漏同一断点下的覆盖。

独立课程及其共享阅读样式不在本次拆分范围内。
