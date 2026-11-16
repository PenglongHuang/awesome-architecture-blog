/** @typedef {'zh-CN' | 'en'} Locale */
export const LOCALES = ['zh-CN', 'en']

const messages = {
  'zh-CN': {
    siteName: 'AI架构师之路', ogImage: 'og-default.svg', tagline: '理解系统，也理解取舍。',
    description: '面向软件工程师的中文架构知识库，涵盖软件架构教程、真实系统架构图、系统设计案例与 AI Agent 工程实践。',
    home: '首页', tutorials: '系列教程', templates: '架构设计', cases: '系统设计',
    courses: '项目学习', about: '关于', search: '搜索', navigation: '主导航',
    searchPlaceholder: '搜索文章、架构图、系统设计案例…', skip: '跳到正文',
    previous: '上一篇', next: '下一篇', contents: '本页目录', related: '延伸阅读',
    relatedTopic: '相关主题', continueReading: '继续阅读', updated: '更新于',
    author: '作者', editor: '编辑', largeText: '大字阅读', focus: '专注阅读',
    comments: '评论', chapter: '第', series: '系列',
    noTranslation: '暂无英文版', languageNavigation: '切换语言',
    quizKicker: '随堂', quizCheck: '确认', quizReset: '重做', explanation: '解析:', verdict: '怎么选:',
    quizChoose: '先选一个选项。', quizCorrect: '答对了。', quizWrong: '不对,再试一次。',
    figure: '图', searchHeading: '全站全文检索', searchIntro: '试试「一致性」「抢票」「RAG」。',
    searchInput: '搜索关键词', searchHint: '试试「一致性」「抢票」「RAG」',
    searchLoading: '正在加载索引…', searchReady: '索引已就绪 · 输入 2 个以上字符开始搜索',
    searchMinimum: '输入 2 个以上字符开始搜索。', searchRunning: '搜索中…',
    searchLoadError: '搜索索引加载失败,请刷新重试。', searchError: '搜索失败,请稍后重试。', searchEmpty: '没有找到结果。',
  },
  en: {
    siteName: "AI Architect's Path", ogImage: 'og-default-en.svg', tagline: 'Understand systems and their trade-offs.',
    description: 'A bilingual knowledge base about software architecture, system design, AI engineering and the trade-offs behind good decisions.',
    home: 'Home', tutorials: 'Tutorials', templates: 'Architecture', cases: 'System design',
    courses: 'Courses', about: 'About', search: 'Search', navigation: 'Main navigation',
    searchPlaceholder: 'Search articles…', skip: 'Skip to content',
    previous: 'Previous', next: 'Next', contents: 'On this page', related: 'Further reading',
    relatedTopic: 'Related topic', continueReading: 'Continue reading', updated: 'Updated',
    author: 'Author', editor: 'Editor', largeText: 'Larger text', focus: 'Focus mode',
    comments: 'Comments', chapter: 'Chapter', series: 'Series',
    noTranslation: 'Not available in English', languageNavigation: 'Change language',
    quizKicker: 'Quick check', quizCheck: 'Check answer', quizReset: 'Try again', explanation: 'Explanation:', verdict: 'The decision:',
    quizChoose: 'Choose an option first.', quizCorrect: 'Correct.', quizWrong: 'Not quite. Try again.',
    figure: 'Figure', searchHeading: 'Search English articles', searchIntro: 'Try “architecture”, “trade-offs” or “data”.',
    searchInput: 'Search keywords', searchHint: 'Try “architecture” or “trade-offs”',
    searchLoading: 'Loading the search index…', searchReady: 'Ready · enter at least 2 characters to search',
    searchMinimum: 'Enter at least 2 characters to search.', searchRunning: 'Searching…',
    searchLoadError: 'Could not load the search index. Please refresh.', searchError: 'Search failed. Please try again.', searchEmpty: 'No results found.',
  },
}

/** @param {Locale} [locale] */
export function messagesFor(locale = 'zh-CN') { return messages[locale] }

/** @param {string} pathname @param {string} [base] @returns {Locale} */
export function localeFromPath(pathname, base = '/') {
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '')
  return /^(?:en)(?:\/|$)/.test(path) ? 'en' : 'zh-CN'
}

/** @param {string} path @param {Locale} [locale] */
export function localePath(path, locale = 'zh-CN') {
  const relative = path.replace(/^\//, '').replace(/^en(?:\/|$)/, '')
  return `/${locale === 'en' ? 'en/' : ''}${relative}`
}

/** Static pages that have a real counterpart. Articles use translation keys instead. */
export const SHARED_PAGES = ['/', '/tutorial/', '/templates/', '/cases/', '/learning/', '/search/', '/about/']

/** @param {string} [value] @returns {Locale} */
export function contentLocale(value) {
  return value === 'en' ? 'en' : 'zh-CN'
}
