function setup(root: HTMLElement) {
  const answer = Number(root.dataset.answer)
  const opts = Array.from(root.querySelectorAll<HTMLButtonElement>('.quiz__opt'))
  const check = root.querySelector<HTMLButtonElement>('.quiz__check')!
  const reset = root.querySelector<HTMLButtonElement>('.quiz__reset')!
  const feedback = root.querySelector<HTMLParagraphElement>('.quiz__feedback')!
  const expl = root.querySelector<HTMLParagraphElement>('.quiz__expl')!
  let selected = -1
  let done = false

  opts.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (done) return
      selected = i
      opts.forEach((b, j) => {
        b.classList.toggle('is-selected', j === i)
        b.setAttribute('aria-pressed', String(j === i))
        if (j !== i) b.classList.remove('is-wrong')
      })
    })
  })

  check.addEventListener('click', () => {
    if (done) return
    if (selected < 0) {
      feedback.hidden = false
      feedback.textContent = '先选一个选项。'
      return
    }
    if (selected === answer) {
      done = true
      opts.forEach((b, i) => {
        b.disabled = true
        if (i === answer) b.classList.add('is-correct')
      })
      check.hidden = true
      reset.hidden = false
      feedback.hidden = false
      feedback.textContent = '答对了。'
      expl.hidden = false
    } else {
      opts[selected].classList.add('is-wrong')
      feedback.hidden = false
      feedback.textContent = '不对,再试一次。'
    }
  })

  reset.addEventListener('click', () => {
    done = false
    selected = -1
    opts.forEach((b) => {
      b.disabled = false
      b.classList.remove('is-selected', 'is-correct', 'is-wrong')
      b.setAttribute('aria-pressed', 'false')
    })
    check.hidden = false
    reset.hidden = true
    feedback.hidden = true
    expl.hidden = true
  })
}

export function initQuizzes(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.quiz[data-answer]').forEach(setup)
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initQuizzes())
  } else {
    initQuizzes()
  }
}
