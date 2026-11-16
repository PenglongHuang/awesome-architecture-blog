import type { Locale } from '../lib/i18n.mjs'
import type { Channel } from './series'

const copy = {
  'zh-CN': {
    home: {
      eyebrow: '一份持续生长的架构阅读集', line1: '先看清系统，', line2: '再动手写代码。',
      hint: '不知道从哪开始？四个方向，按你的需求选择，随时换道。', guide: '按需求选择入口',
      fit: ['适合：想系统学架构的人', '适合：想看懂真实系统的人', '适合：正在做设计决策的人', '适合：想跟着源码实战的人'],
      gain: ['{count} 个系列由浅入深，从架构思维一路读到 AI 时代的工程判断。', '看别人怎么设计：电商、支付、Claude Code 等真实系统的组织结构。', '学自己怎么设计：{count} 个案例，从真实约束走到取舍的完整推理。', '沿真实项目的源码走一遍，把架构理解再往深推一层。'],
      go: '前往', featured: '编辑精选', featuredIntro: '每一期重点推荐的内容，随写作节奏更换。', badge: '精选',
      previous: '上一组精选', next: '下一组精选', featuredList: '精选内容列表', read: '开始阅读', recent: '最近更新', note: '保持好奇，持续思考',
    },
    channels: {
      tutorial: { title: '系列教程', heading: '像架构师一样思考', description: '面向软件工程师的软件架构教程，从架构思维、分布式系统到 AI 工程实践，结合真实案例建立系统设计与技术取舍能力。', intro: '不教你任何语言或框架，只教你一种可迁移的判断力：在写代码之前，先把系统想清楚。' },
      templates: { title: '架构设计', heading: '真实系统长什么样', description: '真实系统架构图与技术拆解，覆盖经典互联网系统、AI 基础设施和 Agent 工程，沿着组件、数据流和设计取舍理解系统。', intro: '只讲问题、组件、数据流和取舍。每张地图末尾都附真实开源项目与工程文档，可顺着去读源码。' },
      cases: { title: '系统设计', heading: '把架构从答案写成推理过程', description: '通过端到端系统设计案例，练习从业务约束、核心模型、架构方案到容量、可靠性和演进策略的完整推演。', intro: '架构设计告诉你这类系统通常长什么样；系统设计告诉你，在这个具体场景里，为什么最后这样取舍。' },
    },
    series: '系列', recent: '最近更新', seriesUnit: '条系列', caseUnit: '个完整推演', mapUnit: '张地图',
    about: { title: '关于', eyebrow: '自 2026 年 1 月 · 全部开源', heading: '关于这个站', intro: '一个专注「架构思维」的双语知识库，讨论系统该长什么样、为什么这样取舍，不讨论具体语法。', author: '站点由', authorAfter: '用 Astro 搭建。希望用清晰的排版和可以亲手探索的案例，让复杂系统更容易理解。', license: '来源与许可', source: '本站内容整理自', credit: '，原作者为 JingWen Fan (study8677)，采用 MIT 许可。转载与再发布保留原始版权及许可声明。', licenseFile: '原始许可文本见仓库根目录 LICENSE。', courses: '项目课程正文目前为中文，目录中会明确标注。' },
    missing: { title: '页面走丢了', heading: '这一页不在图里。', intro: '可能是链接旧了，或者这篇文章还没写。回到地图上重新出发。', home: '回首页', start: '从第一章读起' },
  },
  en: {
    home: {
      eyebrow: 'An evolving architecture reading collection', line1: 'See the system.', line2: 'Then build it.',
      hint: 'Not sure where to start? Choose one of four paths, and change direction whenever you need.', guide: 'Choose a reading path',
      fit: ['For a structured learning path', 'For understanding real systems', 'For making design decisions', 'For exploring real codebases'],
      gain: ['{count} series, from architectural thinking to engineering judgment in the AI era.', 'Explore how commerce, payment systems and coding agents are organized.', '{count} cases follow the reasoning from concrete constraints to architectural trade-offs.', 'Follow real source code to understand how the architecture works in practice. Course content is in Chinese.'],
      go: 'Explore', featured: 'Editor’s picks', featuredIntro: 'Selected series to explore as the collection grows.', badge: 'Featured',
      previous: 'Previous featured group', next: 'Next featured group', featuredList: 'Featured series', read: 'Start reading', recent: 'Latest updates', note: 'Stay curious. Keep thinking.',
    },
    channels: {
      tutorial: { title: 'Architecture tutorials', heading: 'Think like an architect', description: 'Software architecture tutorials covering architectural thinking, distributed systems and AI engineering, grounded in real cases and technical trade-offs.', intro: 'Build a transferable skill: understand what a system should look like before choosing a language or framework.' },
      templates: { title: 'Architecture maps', heading: 'What real systems look like', description: 'Architecture maps for internet systems, AI infrastructure and agents, following their components, data flows and design trade-offs.', intro: 'Explore the problem, components, data flows and trade-offs. Each map links to real open-source projects and engineering documentation.' },
      cases: { title: 'System design', heading: 'Follow the reasoning behind the design', description: 'End-to-end design cases connect business constraints, core models and architectural choices to capacity, reliability and evolution.', intro: 'Architecture maps show how a class of systems is organized. These cases explain why a particular design makes sense under specific constraints.' },
    },
    series: 'Series', recent: 'Latest updates', seriesUnit: 'series', caseUnit: 'end-to-end cases', mapUnit: 'architecture maps',
    about: { title: 'About', eyebrow: 'Open source · since January 2026', heading: 'About this site', intro: 'A bilingual knowledge base about architectural thinking: how systems are organized and why their designers make particular trade-offs.', author: 'Built by', authorAfter: 'with Astro. Clear typography and explorable examples help make complex systems easier to understand.', license: 'Sources and license', source: 'Articles are adapted from', credit: ', originally authored by JingWen Fan (study8677) under the MIT license. Redistribution retains the original copyright and permission notice.', licenseFile: 'The original license is included in the repository’s LICENSE file.', courses: 'Interactive course content is currently in Chinese, clearly marked in the course catalogue.' },
    missing: { title: 'Page not found', heading: 'This page is off the map.', intro: 'The link may be outdated, or this article may not exist yet. Start again from the reading map.', home: 'Back home', start: 'Read the first chapter' },
  },
}
export const pageCopy = (locale: Locale = 'zh-CN') => copy[locale]
export const channelCopy = (channel: Channel, locale: Locale = 'zh-CN') => copy[locale].channels[channel]
export const articleCount = (count: number, locale: Locale = 'zh-CN') => locale === 'en' ? `${count} ${count === 1 ? 'article' : 'articles'}` : `${count} 篇`
export const courseCount = (count: number, locale: Locale = 'zh-CN') => locale === 'en' ? `${count} ${count === 1 ? 'course' : 'courses'}` : `${count} 门`
