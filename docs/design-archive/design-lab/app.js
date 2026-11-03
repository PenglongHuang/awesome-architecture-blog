/* Disposable design exploration, with deliberately small sample content. */
const screen = document.querySelector('#screen');
const descriptions = {
  a: 'A · 纸本编辑部：纸张层次、橄榄灰、衬线标题。让知识库像一本持续更新的专业刊物。',
  b: 'B · 建筑手稿：深橄榄封面、系统草图、清晰索引。让阅读与拆解系统发生在同一张工作台上。',
  c: 'C · 现代阅读室：浅纸底、石墨灰、轻量界面。把长文阅读和项目学习收进同一套安静的体验。',
};
const sections = ['入门篇', '进阶篇', '实战篇', 'AI 协同篇'];
const chapters = [
  ['为什么先有架构思维', '在动手之前，先看清边界、取舍与失败的方式。', '8 分钟', 0],
  ['实现能力与架构判断', '从“这个功能怎么写”到“这个系统该长什么样”。', '6 分钟', 0],
  ['架构到底是什么', '架构不是方框与箭头，而是一组难以撤销的决定。', '7 分钟', 0],
  ['分布式系统的硬道理', '理解延迟、故障与不确定性，重新审视系统边界。', '12 分钟', 1],
  ['数据一致性与系统取舍', '当数据分布在多个节点，如何选择你愿意付出的代价。', '10 分钟', 1],
  ['拆解一个陌生系统', '沿着请求与数据，找到组件真正承担的责任。', '15 分钟', 2],
  ['约束怎么写给 AI', '把边界、验收与失败条件，变成可以执行的上下文。', '9 分钟', 3],
];
const courses = [
  ['LiteLLM', '跟着一个请求，走完 AI 网关的每一层。', '8 个模块', '约 30 分钟', '零基础'],
  ['LLM2Jev', '从数据到打分，拆解一套 RAG 评测系统。', '5 个模块', '约 25 分钟', '进阶'],
  ['Pi', '沿着代理循环，看懂编码 Agent 如何使用工具。', '源码漫游', '交互课程', '进阶'],
];
const modules = ['一次请求的旅程', '鉴权与请求入口', '路由与故障转移', '限流与预算'];
let direction = ['a', 'b', 'c'].includes(new URLSearchParams(location.search).get('direction')) ? new URLSearchParams(location.search).get('direction') : 'a';
let filter = 0;
let moduleIndex = 0;
let flowIndex = 0;
let courseIndex = 0;
let largeText = false;
let focusMode = false;
let completedModules = new Set();
let articleIndex = 0;
const art = () => `<a class="system-art abstract-cover" href="#article-0" aria-label="阅读第一章"><div class="abstract-cover__back"></div><div class="abstract-cover__front"><small>架构师之路 / 阅读集</small><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M6 38 19 10a4 4 0 0 1 3.6-2.3H30L16 38H6Z" fill="currentColor"/><path d="m28 8 14 30H31L22.5 19.5 28 8Z" fill="currentColor" opacity=".62"/><path d="M16 29h15l4 8H12l4-8Z" fill="currentColor"/></svg><strong>理解复杂，<br>做出判断。</strong><span>从一个好问题开始 ↗</span></div></a>`;
const meta = (items) => `<div class="meta">${items.map(x => `<span>${x}</span>`).join('')}</div>`;
const articleHref = (i) => `#article-${i}`;
const pageHeading = (small, title, description) => `<header class="page-opening"><small>${small}</small><h1>${title}</h1><p>${description}</p></header>`;
function home() {
  return `<div class="wrap"><section class="opening"><div class="opening-copy"><h1>先看清系统，<br>再动手写代码。</h1><p>从一张架构图，到一次真实的技术取舍。<br>在阅读、拆解和实践中，建立自己的判断力。</p><div class="opening-actions"><a class="button" href="#article-0">读第一章 <span aria-hidden="true">↗</span></a><a class="text-link" href="#tutorial">浏览全部教程</a></div></div>${art()}</section><div class="intro-strip"><span><strong>43 章教程</strong>，从基础概念走向系统设计</span><span>31 张架构地图 / 6 个设计案例 / 3 门项目课程</span></div><div class="home-grid"><section class="paper-panel"><div class="section-head"><h2>本期阅读</h2><a href="#tutorial">查看目录</a></div><a class="featured" href="#article-0"><span class="pill">入门篇 · 第一章</span><h3>为什么先有架构思维</h3><p>当 AI 能够熟练地写出代码，决定该写什么、系统该长什么样，变得越来越重要。先从这个问题开始。</p>${meta(['2026 年 1 月 6 日', '约 8 分钟'])}</a><div class="quick-links"><a href="#tutorial">建立架构思维 <small>入门教程 ↗</small></a><a href="#maps">看懂真实系统 <small>架构地图 ↗</small></a></div></section><aside class="paper-panel"><div class="section-head"><h2>走进源码</h2><a href="#learning">全部课程</a></div>${courses.slice(0,2).map((c,i) => `<a class="mini-course" href="#course-${i}"><strong>${c[0]}</strong><p>${c[1]}</p><small>${c[2]} / ${c[3]}</small></a>`).join('')}<p class="aside-note">沿着一条真实请求，理解每个组件为什么存在。</p></aside></div><section class="latest"><div class="section-head"><h2>系统设计手记</h2><a href="#cases">全部案例</a></div><div class="story-grid">${['StarArena 演唱会抢票系统','DocuMind 企业 RAG 知识库','CodePilot 编码 Agent 平台'].map((x,i)=>`<a class="story" href="#cases"><small>系统设计 / ${['高并发','知识检索','AI 工程'][i]}</small><h3>${x}</h3><p>${['2 万座演唱会，如何处理瞬间涌入的请求。','给 500 人公司设计一套可追溯的知识库。','从任务入口到工具执行，划清代理的边界。'][i]}</p></a>`).join('')}</div></section></div>`;
}
function tutorial() {
  const filtered = chapters.map((c,i)=>({c,i})).filter(({c})=>c[3]===filter);
  return `<div class="wrap">${pageHeading('入门教程 / 目录原型节选', '像架构师一样思考', '从理解系统开始，逐步练习边界划分、技术取舍和演进判断。按章节阅读，也可以直接进入你关心的问题。')}<div class="catalog-shell"><aside class="catalog-sidebar"><h2>选择一个系列</h2>${sections.map((s,i)=>`<button data-filter="${i}" aria-pressed="${filter===i}">${s}<span>${chapters.filter(c=>c[3]===i).length}</span></button>`).join('')}<p>原型展示 7 篇节选。<br>正式网站共有 43 章。</p></aside><section><div class="catalog-heading"><h2>${sections[filter]}</h2><span>${filtered.length} 篇示例</span></div>${filtered.map(({c,i},n)=>`<a class="chapter-card" href="${articleHref(i)}"><span class="chapter-order">${String(n+1).padStart(2,'0')}</span><div><h3>${c[0]}</h3><p>${c[1]}</p></div><small>${c[2]} ↗</small></a>`).join('')}<div class="catalog-callout">不必一次读完。先带着一个真实问题读，再回到系统里验证它。</div></section></div></div>`;
}
const articleSections = ['一件正在发生的事', '实现能力与架构判断', '架构到底是什么', '把问题带回系统'];
function tocLinks() { return articleSections.map((s,i)=>`<a href="#section-${i}" data-section="section-${i}">${s}</a>`).join(''); }
function article() {
  const item=chapters[articleIndex];
  const isFirst = articleIndex === 0;
  return `<div class="wrap"><div class="reading-top"><a href="#tutorial">入门教程 / ${sections[item[3]]} / ${articleIndex+1}</a><div class="reading-tools"><button data-size aria-pressed="${largeText}">大字阅读</button><button data-focus aria-pressed="${focusMode}">专注阅读</button></div></div><div class="reading-layout ${largeText?'large':''} ${focusMode?'focus':''}"><article class="reading-sheet"><header class="article-heading"><span class="pill">${sections[item[3]]}</span><h1>${item[0]}</h1>${meta(['2026 年 1 月 6 日', `约 ${item[2]}`, '设计原型 · 正文节选'])}<p class="summary">${isFirst?'决定该写什么、系统该长什么样，才是越来越值钱的能力。这一章从实现与判断的区别出发，讨论架构思维为什么值得优先练习。':item[1]+'本页以第一章正文节选演示统一的文章版式。'}</p></header><details class="mobile-toc"><summary>本页目录</summary>${tocLinks()}</details><div class="article-body"><section id="section-0"><h2>一件正在发生的事</h2><p>过去二十年，一个程序员的价值，很大程度上压在<strong>能不能把代码写对、写快</strong>上。谁记得更多 API、谁踩过更多坑、谁手更快，谁就更值钱。</p><p>AI 已经能熟练地补全函数、生成样板、翻译语言、修语法、写测试。那些过去要靠背下来、踩过坑才会的东西，现在几乎是张口就来。</p><blockquote>当怎么写变得廉价，<strong>写什么、为什么这么写</strong>就成了真正稀缺的东西。</blockquote><p>这就是这一章、乃至整套教程要谈的核心：架构思维——在动手之前，先把系统想清楚的能力。</p></section><section id="section-1"><h2>实现能力与架构判断</h2><p>很多人把会写代码和会做系统当成同一种能力的不同熟练度。好像写得够多、够久，自然就会做架构。它们实际上回答着不同的问题。</p><div class="comparison"><div><h3>实现能力</h3><p>这个功能怎么写出来？</p><small>关注语法、库与性能技巧。<br>反馈快，运行代码就能发现问题。</small></div><div><h3>架构判断</h3><p>这个系统该长什么样？</p><small>关注边界、数据流与失败模式。<br>反馈慢，决定会在时间里接受检验。</small></div></div><p>实现能力像是会砌墙，架构判断像是会设计这栋楼。承重墙放哪、地基打多深、将来加盖三层时结构能否承受，这些决定会影响整栋建筑。</p></section><section id="section-2"><h2>架构到底是什么</h2><p>新人最容易误会的一点，是以为架构就是画几个框、连几根线。图能够表达结构，但真正需要解释的是：为什么选择这种结构，换一种方案会怎样？</p><blockquote>实现的错误，代码会告诉你；<br>架构的错误，时间才会告诉你。</blockquote><p>系统里的每一次取舍，都有它的条件。理解这些条件，才有可能在业务变化时重新作出判断。</p></section><section id="section-3"><h2>把问题带回系统</h2><p>选一个你正在维护的系统，试着回答：哪里是它最重要的边界？哪一个组件最先承受压力？如果请求量增加十倍，你会先改哪里？</p><p>带着这些问题继续阅读，再回到真实系统中验证自己的想法。</p></section></div><a class="chapter-bottom" href="${articleHref((articleIndex+1)%chapters.length)}"><div><small>继续阅读</small><strong>${chapters[(articleIndex+1)%chapters.length][0]}</strong></div><span aria-hidden="true">↗</span></a></article><aside class="reading-toc"><div><h2>本页目录</h2>${tocLinks()}<a href="#tutorial" style="margin-top:22px">返回教程目录</a></div></aside></div></div>`;
}
function learning() {
  return `<div class="wrap">${pageHeading('项目学习', '在源码里，把架构走一遍', '跟着一条真实请求，穿过代码、配置与边界。课程也使用统一的导航、字号和阅读方式。')}<div class="learning-grid">${courses.map((c,i)=>`<a class="course-card" href="#course-${i}"><div class="course-cover">${c[0]}</div><span class="pill">${c[4]}</span><h2 style="margin-top:15px">${c[0]}</h2><p>${c[1]}</p>${meta([c[2],c[3],'进入课程 ↗'])}</a>`).join('')}</div></div>`;
}
const flows = [
  ['客户端', '客户端把模型名称、消息和调用参数发送给网关。这是请求的起点，业务无需直接面对每一家模型厂商。'],
  ['AI 网关', '网关识别调用者，检查权限、预算和速率限制，然后选择合适的模型与服务商。统一入口承担的是策略与边界。'],
  ['模型服务', '模型服务处理请求并返回结果。网关可以在调用失败时选择备用服务，再把响应转换成统一格式返回。'],
];
function course() {
  const c = courses[courseIndex];
  return `<div class="wrap"><div class="reading-top"><a href="#learning">项目学习 / ${c[0]}</a><span>交互示例 · 课程内容节选</span></div><div class="course-workspace"><aside class="module-list"><h2>${c[0]} 漫游</h2><div class="progress-track"><span style="width:${completedModules.size/4*100}%"></span></div>${modules.map((m,i)=>`<button data-module="${i}" aria-current="${moduleIndex===i?'step':'false'}">${completedModules.has(i)?'✓':String(i+1).padStart(2,'0')}　${m}</button>`).join('')}<span class="muted">已完成 ${completedModules.size} / 4 个示例模块</span></aside><article class="lesson"><span class="pill">模块 ${moduleIndex+1} / 4</span><h1>${modules[moduleIndex]}</h1><p>${['先建立全貌。一个请求从客户端出发，经由网关抵达模型服务，再沿原路返回。点击下方节点，看看每一层承担什么责任。','请求进入系统之前，先确定“你是谁”和“你能做什么”。把访问权限与业务逻辑分开，才能让边界保持清晰。','当首选服务不可用时，网关需要选择备用服务。一次重试也意味着更多延迟与成本，需要明确上限。','限流控制单位时间内的调用量，预算约束可消耗的成本。它们共同保护系统，也限制失控请求带来的影响。'][moduleIndex]}</p><h2>沿着请求走一遍</h2><div class="flow-demo" role="group" aria-label="探索请求路径">${flows.map((f,i)=>`${i?'<span aria-hidden="true">→</span>':''}<button data-flow="${i}" aria-pressed="${flowIndex===i}">${f[0]}</button>`).join('')}</div><section class="flow-detail" aria-live="polite"><h3>${flows[flowIndex][0]}</h3><p>${flows[flowIndex][1]}</p></section><p>这段交互用于体验课程界面；正式迁移时会保留每门课的完整模块、架构图与测验。</p><div class="lesson-actions"><a href="#learning" class="text-link">返回课程</a><button class="button" data-next-module>${moduleIndex===3?'完成示例课程':'完成并进入下一模块'}</button></div></article></div></div>`;
}
function collection(kind) {
  const map=kind==='maps';
  const items=map?['AI 网关','企业 RAG','编码 Agent','电商交易']:['StarArena 抢票系统','DocuMind 企业知识库','SyncRoom 协同工作台','CodePilot Agent 平台'];
  return `<div class="wrap">${pageHeading(map?'架构地图 / 示例精选':'系统设计 / 示例精选',map?'把复杂系统，摊开来看':'从真实约束出发做设计',map?'看见组件如何协作，也理解边界为什么放在这里。':'流量、成本、数据与团队规模，都会改变一个系统的答案。')}<div class="map-shelf">${items.map((t,i)=>`<section class="paper-panel"><div class="architecture-thumb"><span>${['请求入口','用户','客户端','任务'][i]}</span><i>→</i><span>${['网关','检索服务','协同服务','代理循环'][i]}</span><i>→</i><span>${['模型','知识库','事件流','工具'][i]}</span></div><h2>${t}</h2><p>围绕核心链路，分析组件的职责、故障边界与演进条件。</p><a class="text-link" href="#course-0">体验交互式架构拆解</a></section>`).join('')}</div></div>`;
}
function render({reset=true}={}) {
  const route=location.hash.slice(1)||'home';
  let active=route;
  if(route.startsWith('article-')){articleIndex=Math.min(chapters.length-1,Math.max(0,Number(route.split('-')[1])||0));active='tutorial';screen.innerHTML=article();}
  else if(route.startsWith('course-')){const nextCourse=Math.min(2,Math.max(0,Number(route.split('-')[1])||0));if(nextCourse!==courseIndex){moduleIndex=0;completedModules=new Set();}courseIndex=nextCourse;active='learning';screen.innerHTML=course();}
  else screen.innerHTML=route==='tutorial'?tutorial():route==='learning'?learning():route==='maps'||route==='cases'?collection(route):home();
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=`${direction.toUpperCase()} · ${route.startsWith('article')?'文章阅读':route.startsWith('course')?'交互课程':{home:'首页',tutorial:'教程目录',learning:'项目学习',maps:'架构地图',cases:'系统设计'}[active]||'首页'} · 整站设计原型`;
  if(reset)window.scrollTo({top:0,behavior:'instant'});
}
function setDirection(value) {
  direction=value;
  document.body.dataset.direction=value;
  document.querySelector('#direction-description').textContent=descriptions[value];
  document.querySelectorAll('.direction-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===value)));
  const url=new URL(location.href);url.searchParams.set('direction',value);history.replaceState(null,'',url);
  document.title=document.title.replace(/^[ABC] · /,`${value.toUpperCase()} · `);
}
const searchDialog=document.querySelector('#search-dialog');
const searchInput=document.querySelector('#search-input');
function search() {
  const q=searchInput.value.trim().toLocaleLowerCase();
  const items=[...chapters.map((c,i)=>({title:c[0],text:c[1],kind:sections[c[3]],href:articleHref(i)})),...courses.map((c,i)=>({title:c[0],text:c[1],kind:'项目课程',href:`#course-${i}`}))];
  const matches=items.filter(x=>!q||`${x.title} ${x.text} ${x.kind}`.toLocaleLowerCase().includes(q));
  const target=document.querySelector('#search-results');target.replaceChildren();
  if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent='没有找到相关示例，换一个关键词试试。';target.append(p);return;}
  for(const x of matches){const a=document.createElement('a');a.className='search-result';a.href=x.href;const strong=document.createElement('strong');strong.textContent=x.title;const small=document.createElement('small');small.textContent=x.kind;a.append(strong,small);a.addEventListener('click',()=>searchDialog.close());target.append(a);}
}
function openSearch(){searchDialog.showModal();searchInput.value='';search();searchInput.focus();}
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.matches('.direction-options button'))setDirection(target.dataset.direction);
  if(target.hasAttribute('data-search'))openSearch();
  if(target.hasAttribute('data-close-search'))searchDialog.close();
  if(target.hasAttribute('data-filter')){filter=Number(target.dataset.filter);render({reset:false});document.querySelector(`[data-filter="${filter}"]`).focus({preventScroll:true});}
  if(target.hasAttribute('data-size')){largeText=!largeText;render({reset:false});document.querySelector('[data-size]').focus({preventScroll:true});}
  if(target.hasAttribute('data-focus')){focusMode=!focusMode;render({reset:false});document.querySelector('[data-focus]').focus({preventScroll:true});}
  if(target.hasAttribute('data-section')){event.preventDefault();document.getElementById(target.dataset.section)?.scrollIntoView({behavior:'auto'});}
  if(target.hasAttribute('data-module')){moduleIndex=Number(target.dataset.module);render({reset:false});document.querySelector('.lesson').scrollIntoView({block:'start',behavior:'auto'});}
  if(target.hasAttribute('data-flow')){flowIndex=Number(target.dataset.flow);render({reset:false});document.querySelector(`[data-flow="${flowIndex}"]`).focus({preventScroll:true});}
  if(target.hasAttribute('data-next-module')){completedModules.add(moduleIndex);moduleIndex=Math.min(3,moduleIndex+1);render({reset:false});document.querySelector('.lesson').scrollIntoView({block:'start',behavior:'auto'});if(completedModules.size===4)document.querySelector('[data-next-module]').textContent='已完成全部示例 ✓';}
});
searchInput.addEventListener('input',search);
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!searchDialog.open){event.preventDefault();openSearch();}});
window.addEventListener('hashchange',()=>render());
setDirection(direction);render();
