import { t } from './i18n.js?v=7'
import { verseParts } from './mark.js?v=5'

const WIDTH = 1080
const PAD = 72
const AR = 'UthmanicHafs, "Noto Naskh Arabic", serif'
const UI = 'system-ui, "Segoe UI", Roboto, sans-serif'

function stripeColor(pos) {
  if (pos === 'fiil') return '#1d4e89'
  if (pos === 'isim') return '#6d28a8'
  return '#1b4334'
}

function wrap(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function arabicLines(ctx, parts, maxWidth) {
  const tokens = parts.filter((part) => part.text && !/^\s+$/.test(part.text))
  const gap = ctx.measureText(' ').width
  const lines = []
  let line = []
  let width = 0
  for (const token of tokens) {
    const wordWidth = ctx.measureText(token.text).width
    const add = line.length ? gap + wordWidth : wordWidth
    if (line.length && width + add > maxWidth) {
      lines.push(line)
      line = [token]
      width = wordWidth
    } else {
      line.push(token)
      width += add
    }
  }
  if (line.length) lines.push(line)
  return { lines, gap }
}

export async function renderCard(card) {
  await document.fonts.load(`64px ${AR}`)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const inner = WIDTH - PAD * 2
  ctx.font = `64px ${AR}`
  const arabic = arabicLines(ctx, verseParts(card.verse, card.form), inner)
  ctx.font = `34px ${UI}`
  const readingLines = wrap(ctx, card.verseReading, inner)
  ctx.font = `36px ${UI}`
  const mealLines = wrap(ctx, card.meal, inner)
  ctx.font = `600 30px ${UI}`
  const tags = (card.tags || []).filter(Boolean)
  const tagRows = []
  let row = []
  let rowWidth = 0
  for (const tag of tags) {
    const pill = ctx.measureText(tag).width + 36
    if (row.length && rowWidth + 12 + pill > inner) {
      tagRows.push(row)
      row = [{ tag, pill }]
      rowWidth = pill
    } else {
      row.push({ tag, pill })
      rowWidth += (row.length > 1 ? 12 : 0) + pill
    }
  }
  if (row.length) tagRows.push(row)

  const arabicLine = 108
  let height = PAD
  height += 52
  height += 36 + 120
  if (card.reading) height += 52
  if (card.meaning) height += 78
  if (tagRows.length) height += tagRows.length * 64 + 8
  if (card.verse) height += 28 + arabic.lines.length * arabicLine
  if (readingLines.length) height += 16 + readingLines.length * 48
  if (mealLines.length) height += 20 + mealLines.length * 52
  height += PAD

  canvas.width = WIDTH
  canvas.height = height
  ctx.fillStyle = '#fffcf7'
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.fillStyle = stripeColor(card.pos)
  ctx.fillRect(0, 0, 16, height)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#1b4334'
  ctx.font = `800 40px ${UI}`
  ctx.textAlign = 'left'
  ctx.direction = 'ltr'
  ctx.fillText(card.ref || '', PAD, PAD + 40)

  let y = PAD + 52 + 36
  ctx.fillStyle = '#1a1916'
  ctx.font = `64px ${AR}`
  ctx.textAlign = 'center'
  ctx.direction = 'rtl'
  ctx.fillText(card.word || '', WIDTH / 2, y + 88)
  y += 120

  ctx.direction = 'ltr'
  if (card.reading) {
    ctx.fillStyle = '#6d675f'
    ctx.font = `34px ${UI}`
    ctx.fillText(card.reading, WIDTH / 2, y + 40)
    y += 52
  }
  if (card.meaning) {
    ctx.fillStyle = '#1a1916'
    ctx.font = `800 48px ${UI}`
    ctx.fillText(card.meaning, WIDTH / 2, y + 56)
    y += 78
  }
  if (tagRows.length) {
    y += 8
    ctx.font = `600 30px ${UI}`
    ctx.textAlign = 'center'
    for (const pills of tagRows) {
      const total = pills.reduce((sum, pill) => sum + pill.pill, 0) + (pills.length - 1) * 12
      let x = (WIDTH - total) / 2
      for (const pill of pills) {
        ctx.fillStyle = '#e8f2ec'
        ctx.beginPath()
        ctx.roundRect(x, y, pill.pill, 48, 24)
        ctx.fill()
        ctx.fillStyle = '#1b4334'
        ctx.fillText(pill.tag, x + pill.pill / 2, y + 33)
        x += pill.pill + 12
      }
      y += 64
    }
  }

  if (card.verse) {
    y += 16
    ctx.strokeStyle = '#e4ddd0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(WIDTH - PAD, y)
    ctx.stroke()
    y += 28 + 78
    ctx.font = `64px ${AR}`
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    const drawn = arabicLines(ctx, verseParts(card.verse, card.form), inner)
    for (const line of drawn.lines) {
      let x = WIDTH - PAD
      for (const token of line) {
        const wordWidth = ctx.measureText(token.text).width
        if (token.hit) {
          const box = ctx.measureText(token.text)
          const ascent = box.actualBoundingBoxAscent || 58
          const descent = box.actualBoundingBoxDescent || 18
          ctx.fillStyle = '#ffd0d0'
          ctx.fillRect(x - wordWidth - 8, y - ascent - 6, wordWidth + 16, ascent + descent + 12)
          ctx.fillStyle = '#c1121f'
        } else {
          ctx.fillStyle = '#1a1916'
        }
        ctx.fillText(token.text, x, y)
        x -= wordWidth + drawn.gap
      }
      y += arabicLine
    }
    y -= 20
  }

  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  if (readingLines.length) {
    y += 16
    ctx.fillStyle = '#6d675f'
    ctx.font = `34px ${UI}`
    for (const line of readingLines) {
      y += 48
      ctx.fillText(line, PAD, y)
    }
  }
  if (mealLines.length) {
    y += 20
    ctx.fillStyle = '#1a1916'
    ctx.font = `36px ${UI}`
    for (const line of mealLines) {
      y += 52
      ctx.fillText(line, PAD, y)
    }
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('png')
  return blob
}

function showPreview(blob) {
  const url = URL.createObjectURL(blob)
  document.getElementById('share-preview')?.remove()
  const wrap = document.createElement('div')
  wrap.id = 'share-preview'
  wrap.innerHTML = `<div class="share-sheet"><img alt="" src="${url}"><p>${t('shareHint')}</p><button type="button" class="share-close">${t('close')}</button></div>`
  const close = () => {
    wrap.remove()
    URL.revokeObjectURL(url)
  }
  wrap.addEventListener('click', (event) => {
    if (event.target === wrap || event.target.closest('.share-close')) close()
  })
  document.body.appendChild(wrap)
}

function canShareFiles(name) {
  if (!navigator.canShare) return false
  const probe = new File([new Blob()], name, { type: 'image/png' })
  try {
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export function shareCard(card) {
  const blobPromise = renderCard(card)
  const name = `${String(card.ref || 'ayet').replace(':', '-')}.png`
  if (canShareFiles(name)) {
    return blobPromise.then(async (blob) => {
      const file = new File([blob], name, { type: 'image/png' })
      try {
        await navigator.share({ files: [file], title: card.ref || '' })
        return 'shared'
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        showPreview(blob)
        return 'preview'
      }
    })
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    return navigator.clipboard
      .write([new ClipboardItem({ 'image/png': blobPromise })])
      .then(() => 'copied')
      .catch(async () => {
        showPreview(await blobPromise)
        return 'preview'
      })
  }
  return blobPromise.then((blob) => {
    showPreview(blob)
    return 'preview'
  })
}
