const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function renderQuizHtml(q) {
  const opts = q.options
    .map((o, i) => `<button type="button" class="quiz__opt" data-index="${i}" aria-pressed="false"><span class="quiz__key">${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span></button>`)
    .join('')
  return `<div class="quiz" data-answer="${q.answer}">
<p class="quiz__kicker">随堂</p>
<p class="quiz__q">${esc(q.question)}</p>
<div class="quiz__opts">${opts}</div>
<div class="quiz__actions"><button type="button" class="quiz__check">确认</button><button type="button" class="quiz__reset" hidden>重做</button></div>
<p class="quiz__feedback" role="status" hidden></p>
<p class="quiz__expl" hidden><strong>解析:</strong> ${esc(q.explanation)}</p>
</div>`
}

export function renderDecisionHtml(d) {
  return `<div class="decision">
<p class="decision__title">${esc(d.title)}</p>
<div class="decision__cols">
<div><h4>A · ${esc(d.a)}</h4><p>${esc(d.aDesc)}</p></div>
<div><h4>B · ${esc(d.b)}</h4><p>${esc(d.bDesc)}</p></div>
</div>
<p class="decision__verdict"><strong>怎么选:</strong> ${esc(d.verdict)}</p>
</div>`
}
