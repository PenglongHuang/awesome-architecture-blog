import { messagesFor } from './i18n.mjs'
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function renderQuizHtml(q, locale = 'zh-CN') {
  const t = messagesFor(locale)
  const opts = q.options
    .map((o, i) => `<button type="button" class="quiz__opt" data-index="${i}" aria-pressed="false"><span class="quiz__key">${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span></button>`)
    .join('')
  return `<div class="quiz" data-pagefind-ignore data-locale="${locale}" data-answer="${q.answer}">
<p class="quiz__kicker">${t.quizKicker}</p>
<p class="quiz__q">${esc(q.question)}</p>
<div class="quiz__opts">${opts}</div>
<div class="quiz__actions"><button type="button" class="quiz__check">${t.quizCheck}</button><button type="button" class="quiz__reset" hidden>${t.quizReset}</button></div>
<p class="quiz__feedback" role="status" hidden></p>
<p class="quiz__expl" hidden><strong>${t.explanation}</strong> ${esc(q.explanation)}</p>
</div>`
}

export function renderDecisionHtml(d, locale = 'zh-CN') {
  const t = messagesFor(locale)
  return `<div class="decision" data-pagefind-ignore>
<p class="decision__title">${esc(d.title)}</p>
<div class="decision__cols">
<div><h4>A · ${esc(d.a)}</h4><p>${esc(d.aDesc)}</p></div>
<div><h4>B · ${esc(d.b)}</h4><p>${esc(d.bDesc)}</p></div>
</div>
<p class="decision__verdict"><strong>${t.verdict}</strong> ${esc(d.verdict)}</p>
</div>`
}
