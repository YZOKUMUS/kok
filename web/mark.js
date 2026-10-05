function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fold(value) {
  return String(value ?? '')
    .replace(/ى\u0670/g, 'ا')
    .replace(/و\u0670/g, 'ا')
    .replace(/\u0670/g, 'ا')
    .replace(/[\u0640\u064B-\u065F\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, '')
    .replace(/ئ/g, '')
    .replace(/ء/g, '')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ا{2,}/g, 'ا')
}

function targetForm(value) {
  const text = String(value ?? '').match(/[\u0600-\u06FF\u064B-\u065F\u0670\u06D6-\u06ED\s]+/)
  return text ? text[0].trim() : ''
}

export function verseParts(verse, form) {
  const raw = String(verse ?? '')
  const target = targetForm(form)
  const needle = fold(target).replace(/\s+/g, '')
  const parts = raw.split(/(\s+)/)
  if (!needle) return parts.map((text) => ({ text, hit: false }))

  const words = []
  parts.forEach((part, index) => {
    if (part && !/^\s+$/.test(part) && fold(part)) words.push({ index, part })
  })

  const marked = new Set()
  let cursor = 0
  while (cursor < words.length) {
    let end = -1
    let joined = ''
    for (let j = cursor; j < words.length && j < cursor + 4; j += 1) {
      joined = j === cursor ? words[j].part : `${joined} ${words[j].part}`
      if (joined === target) {
        end = j
        break
      }
    }
    if (end < 0) {
      let folded = ''
      for (let j = cursor; j < words.length && j < cursor + 4; j += 1) {
        folded += fold(words[j].part)
        if (folded === needle) {
          end = j
          break
        }
      }
    }
    if (end < 0) {
      cursor += 1
      continue
    }
    for (let k = cursor; k <= end; k += 1) marked.add(words[k].index)
    cursor = end + 1
  }

  return parts.map((text, index) => ({ text, hit: marked.has(index) }))
}

export function highlightVerse(verse, form) {
  return verseParts(verse, form)
    .map((part) => {
      const html = escapeHtml(part.text)
      return part.hit ? `<span class="hit">${html}</span>` : html
    })
    .join('')
}
