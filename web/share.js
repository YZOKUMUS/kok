import { t } from './i18n.js?v=20'
import { verseParts } from './mark.js?v=5'

const WIDTH = 1080
const PAD = 72
const AR = 'UthmanicHafs, "Noto Naskh Arabic", serif'
const UI = 'Inter, system-ui, "Segoe UI", Roboto, sans-serif'
const APP_URL = 'https://kok-calis.web.app/'

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

function cardCaption(card) {
  const bits = [card.word, card.meaning, card.ref].filter(Boolean)
  const lead = bits.join(' · ')
  return lead ? `${lead}\n${APP_URL}` : APP_URL
}

export async function shareCard(card) {
  const caption = cardCaption(card)
  if (navigator.share) {
    try {
      await navigator.share({ title: card.ref || t('homeTitle'), text: caption, url: APP_URL })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') throw err
    }
  }
  const copied = await copyText(caption)
  if (copied) return 'copied'
  showPreview(await renderCard(card))
  return 'preview'
}

/* ── App share card (1080×1350) ─────────────────────────── */

function gradient(ctx, x0, y0, x1, y1, stops) {
  const paint = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [at, color] of stops) paint.addColorStop(at, color)
  return paint
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawTapHand(ctx, tipX, tipY) {
  ctx.save()
  ctx.translate(tipX, tipY)
  ctx.fillStyle = '#fffdf8'
  ctx.strokeStyle = '#e0b15a'
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.arc(0, 8, 22, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.roundRect(-18, -108, 36, 96, 18)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.roundRect(-42, -168, 102, 74, 28)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(52, -108, 18, 24, 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#e7d7b4'
  ctx.beginPath()
  ctx.ellipse(0, -86, 8, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export async function renderAppCard() {
  try {
    await document.fonts.load(`800 92px ${UI}`)
    await document.fonts.load(`600 36px ${UI}`)
    await document.fonts.load(`500 800px ${AR}`)
  } catch {
    /* fonts stay on the system fallback */
  }

  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f4f1e9'
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(940, 120, 40, 940, 120, 720)
  glow.addColorStop(0, 'rgba(44, 122, 91, 0.14)')
  glow.addColorStop(1, 'rgba(44, 122, 91, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = gradient(ctx, 48, 48, 1032, 840, [
    [0, '#0c3f2e'],
    [0.6, '#176046'],
    [1, '#23795a'],
  ])
  rounded(ctx, 48, 48, 984, 792, 58)
  ctx.fill()

  ctx.save()
  ctx.globalAlpha = 0.09
  ctx.fillStyle = '#f7f3e8'
  ctx.font = `500 760px ${AR}`
  ctx.textAlign = 'right'
  ctx.direction = 'rtl'
  ctx.fillText('ك', 1012, 800)
  ctx.restore()

  ctx.fillStyle = 'rgba(247, 243, 232, 0.16)'
  rounded(ctx, 112, 116, 76, 76, 22)
  ctx.fill()
  ctx.fillStyle = '#f7f3e8'
  ctx.beginPath()
  ctx.moveTo(126, 140)
  ctx.bezierCurveTo(134, 136, 142, 136, 148, 140)
  ctx.lineTo(148, 172)
  ctx.bezierCurveTo(142, 168, 134, 168, 126, 172)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 0.78
  ctx.beginPath()
  ctx.moveTo(152, 140)
  ctx.bezierCurveTo(160, 136, 168, 136, 176, 140)
  ctx.lineTo(176, 172)
  ctx.bezierCurveTo(168, 168, 160, 168, 152, 172)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#0c3f2e'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(150, 140)
  ctx.lineTo(150, 172)
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.font = `800 42px ${UI}`
  ctx.fillText('Kök çalış', 212, 168)

  ctx.fillStyle = 'rgba(247, 243, 232, 0.78)'
  rounded(ctx, 812, 126, 170, 56, 28)
  ctx.fill()
  ctx.fillStyle = '#0c3f2e'
  ctx.font = `700 24px ${UI}`
  ctx.textAlign = 'center'
  ctx.fillText('Ücretsiz', 897, 162)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(247, 243, 232, 0.66)'
  ctx.font = `700 23px ${UI}`
  ctx.letterSpacing = '5px'
  ctx.fillText(t('shareCardKicker'), 112, 288)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#f7f3e8'
  ctx.font = `800 92px ${UI}`
  ctx.fillText(t('shareCardTitle1'), 112, 402)
  ctx.fillText(t('shareCardTitle2'), 112, 500)

  ctx.fillStyle = 'rgba(247, 243, 232, 0.9)'
  ctx.font = `600 35px ${UI}`
  ctx.fillText(t('shareCardStats'), 112, 604)

  ctx.fillStyle = 'rgba(247, 243, 232, 0.68)'
  ctx.font = `400 30px ${UI}`
  ctx.fillText(t('shareCardLine'), 112, 660)

  ctx.fillStyle = '#fffdf8'
  rounded(ctx, 112, 896, 856, 96, 48)
  ctx.fill()
  ctx.strokeStyle = '#e5ded0'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.strokeStyle = '#68736b'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(176, 940, 15, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(187, 951)
  ctx.lineTo(199, 963)
  ctx.stroke()

  ctx.fillStyle = '#16211b'
  ctx.font = `500 34px ${UI}`
  ctx.fillText('rahman', 222, 955)

  ctx.fillStyle = '#0f4c38'
  rounded(ctx, 112, 1030, 856, 116, 58)
  ctx.fill()
  ctx.fillStyle = '#f7f3e8'
  ctx.font = `700 35px ${UI}`
  ctx.fillText('kok-calis.web.app', 168, 1102)
  drawTapHand(ctx, 860, 1048)

  ctx.fillStyle = '#0f4c38'
  ctx.font = `800 36px ${UI}`
  ctx.textAlign = 'center'
  ctx.fillText(t('shareCardTap'), W / 2, 1228)
  ctx.fillStyle = '#68736b'
  ctx.font = `500 24px ${UI}`
  ctx.fillText(t('shareCardHint'), W / 2, 1276)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('png')
  return blob
}

/* ── Share sheet ────────────────────────────────────────── */

const ICONS = {
  whatsapp:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.1-.7-2.5-1.1-4.1-3.7-4.2-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.8-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l1-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.7-.1 1.3Z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.2-1.3 1.5-1.3H17V2.2c-.3 0-1.3-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H8v3.2h2.5V22h3.4v-10.3h2.6l.4-3.2H14Z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>',
  share:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15.5V3.8M8.2 7.2 12 3.4l3.8 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12.8v6.4c0 .8.6 1.4 1.4 1.4h11.2c.8 0 1.4-.6 1.4-1.4v-6.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  link:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}

function toast(message) {
  document.querySelector('.share-toast')?.remove()
  const note = document.createElement('div')
  note.className = 'share-toast'
  note.setAttribute('role', 'status')
  note.textContent = message
  document.body.appendChild(note)
  setTimeout(() => note.remove(), 2600)
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function shareApp() {
  let blob = null
  try {
    blob = await renderAppCard()
  } catch {
    blob = null
  }
  const name = 'kok-calis.png'
  const caption = `${t('shareAppCaption')}\n${APP_URL}`

  document.getElementById('app-share')?.remove()
  const wrap = document.createElement('div')
  wrap.id = 'app-share'
  wrap.className = 'app-share'
  wrap.setAttribute('role', 'dialog')
  wrap.setAttribute('aria-modal', 'true')
  wrap.setAttribute('aria-labelledby', 'app-share-title')

  const image = blob ? URL.createObjectURL(blob) : ''
  wrap.innerHTML = `
    <div class="app-share-panel" role="document" tabindex="-1">
      <div class="app-share-head">
        <h2 id="app-share-title">${t('shareTitle')}</h2>
        <button type="button" class="sheet-x" data-share-close aria-label="${t('close')}">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" /></svg>
        </button>
      </div>
      ${image ? `<img class="app-share-img" src="${image}" alt="${t('sharePreviewAlt')}" />` : ''}
      <p class="app-share-note">${t('shareAppHint')}</p>
      <div class="app-share-targets">
        <button type="button" class="share-target" data-share-target="whatsapp">
          <span class="share-target-ico wa">${ICONS.whatsapp}</span>
          <span>WhatsApp</span>
        </button>
        <button type="button" class="share-target" data-share-target="facebook">
          <span class="share-target-ico fb">${ICONS.facebook}</span>
          <span>Facebook</span>
        </button>
        <button type="button" class="share-target" data-share-target="instagram">
          <span class="share-target-ico ig">${ICONS.instagram}</span>
          <span>Instagram</span>
        </button>
      </div>
      <button type="button" class="btn wide app-share-primary" data-share-target="native">
        <span class="share-mini-ico">${ICONS.share}</span>${t('shareNative')}
      </button>
      <div class="app-share-mini">
        <button type="button" data-share-target="copy"><span class="share-mini-ico">${ICONS.link}</span>${t('shareCopyLink')}</button>
        <button type="button" data-share-target="download"><span class="share-mini-ico">${ICONS.download}</span>${t('shareDownload')}</button>
      </div>
    </div>`

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    wrap.remove()
    if (image) URL.revokeObjectURL(image)
    document.body.classList.remove('share-open')
    document.removeEventListener('keydown', onKey)
  }

  const onKey = (event) => {
    if (event.key === 'Escape') close()
  }

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('homeTitle'), text: caption, url: APP_URL })
        close()
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    const copied = await copyText(caption)
    toast(copied ? t('shareLinkCopied') : t('shareFail'))
  }

  wrap.addEventListener('click', async (event) => {
    if (event.target === wrap || event.target.closest('[data-share-close]')) {
      close()
      return
    }
    const action = event.target.closest('[data-share-target]')?.getAttribute('data-share-target')
    if (!action) return
    if (action === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank', 'noopener')
      return
    }
    if (action === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}`, '_blank', 'noopener')
      return
    }
    if (action === 'instagram') {
      const copied = await copyText(caption)
      window.open('https://www.instagram.com/', '_blank', 'noopener')
      toast(copied ? t('shareInstagramHint') : t('shareFail'))
      return
    }
    if (action === 'copy') {
      const copied = await copyText(caption)
      toast(copied ? t('shareLinkCopied') : t('shareFail'))
      return
    }
    if (action === 'download') {
      if (blob) {
        download(blob, name)
        toast(t('shareImageSaved'))
      }
      return
    }
    if (action === 'native') await shareNative()
  })

  document.body.appendChild(wrap)
  document.body.classList.add('share-open')
  document.addEventListener('keydown', onKey)
  wrap.querySelector('.app-share-panel')?.focus()
  return { image: Boolean(blob) }
}
