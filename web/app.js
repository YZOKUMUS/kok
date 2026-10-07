import { shortMeaning } from './gloss.js?v=6'
import { applyLang, lang, locale, t } from './i18n.js?v=12'
import { paintQuran, stopReading } from './read.js?v=4'
import { queryStem, wordHits } from './words.js?v=2'
import { dueWordCount, knownWordCount, readState, studiedCount } from './study.js'

const CONTENT = '../content'
const APP_URL = 'https://yzokumus.github.io/kok/'
const LETTER_ORDER = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function firstLetter(root) {
  return (root.lettersArabic || '').trim().split(/\s+/)[0] || ''
}

async function loadIndex() {
  const res = await fetch(`${CONTENT}/index.json`)
  if (!res.ok) throw new Error(t('indexError'))
  return res.json()
}

const allRoots = await loadIndex()
  .then((index) => index.roots)
  .catch((err) => {
    document.getElementById('error').classList.remove('hidden')
    document.getElementById('error').textContent = err.message
    return []
  })

const byLetter = new Map()
for (const root of allRoots) {
  const letter = firstLetter(root)
  const bucket = byLetter.get(letter) || []
  bucket.push(root)
  byLetter.set(letter, bucket)
}

const letters = [...byLetter.keys()].sort((a, b) => {
  const ia = LETTER_ORDER.indexOf(a)
  const ib = LETTER_ORDER.indexOf(b)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
})

let letter = ''
let tab = 'sozluk'
const lists = {
  fiiller: null,
  isimler: null,
}

const listTabs = {
  fiiller: {
    file: 'verbs.json',
    key: 'verbs',
    error: 'verbError',
    empty: 'emptyVerbs',
    href: './lesson.html?fiil=1',
    eyebrow: 'verbEyebrow',
    title: 'verbTitle',
    blurb: 'verbBlurb',
    kind: 'verb',
  },
  isimler: {
    file: 'nouns.json',
    key: 'nouns',
    error: 'nounError',
    empty: 'emptyNouns',
    href: './lesson.html?isim=1',
    eyebrow: 'nounEyebrow',
    title: 'nounTitle',
    blurb: 'nounBlurb',
    kind: 'noun',
  },
}
const state = readState()
const studied = state.studied
const last = allRoots.find((root) => root.id === state.lastId) || null

function foldTr(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('â', 'a')
    .replaceAll('î', 'i')
    .replaceAll('û', 'u')
}

function trTokens(value) {
  return foldTr(value)
    .split(/[^a-zçğıöşü]+/)
    .filter(Boolean)
}

function arKey(value) {
  return String(value || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[^\u0600-\u06FF]/g, '')
}

const WORD = /[A-Za-zÇĞİÖŞÜÂÎÛçğıöşüâîû]+/g
const AUX = new Set(['etmek', 'olmak', 'kılmak', 'eylemek', 'vermek', 'yapmak', 'gelmek', 'kalmak', 'bulmak', 'demek', 'görmek', 'bulunmak'])
const glossById = new Map()

function indexWords(text, into) {
  for (const match of String(text || '').matchAll(WORD)) {
    const key = foldTr(match[0])
    if (key && !into.has(key)) into.set(key, match[0])
  }
}

function rememberGloss(id, meanings, derivatives) {
  const tokens = new Map()
  const heads = new Map()
  indexWords(meanings, tokens)
  indexWords(derivatives, heads)
  for (const part of String(meanings || '').split(/[.,;:]+/)) {
    const match = part.match(WORD)
    if (!match) continue
    const key = foldTr(match[0])
    if (key && !heads.has(key)) heads.set(key, match[0])
  }
  const blob = trTokens(`${meanings || ''} ${derivatives || ''}`).join(' ')
  glossById.set(id, { tokens, heads, blob })
}

for (const root of allRoots) rememberGloss(root.id, root.meaningsPreview, '')

fetch(`${CONTENT}/dict.json?v=1`)
  .then((res) => (res.ok ? res.json() : null))
  .then((data) => {
    if (!data) return
    for (const [id, row] of Object.entries(data)) rememberGloss(id, row[0], row[1])
    const input = document.getElementById('q')
    if (tab === 'sozluk' && input && input.value.trim()) paint(input.value)
  })
  .catch(() => {})

function rankDictionary(query) {
  const needle = trTokens(query).join(' ')
  const qTokens = needle ? needle.split(' ') : []
  const qAr = arKey(query)
  if (!needle && !qAr) return []
  const hits = []
  for (const root of allRoots) {
    const entry = glossById.get(root.id) || { tokens: new Map(), heads: new Map(), blob: '' }
    const name = trTokens(root.latinName)
    const arabic = arKey(root.lettersArabic)
    let score = 0
    let key = name.join(' ')
    let label = ''
    const take = (next, sortKey, surface) => {
      if (next <= score) return
      score = next
      key = sortKey
      label = surface || ''
    }
    if (qTokens.length === 1 && qTokens[0].length >= 2) {
      const q = qTokens[0]
      if (entry.heads.has(q)) take(100, q, entry.heads.get(q))
      else if (entry.tokens.has(q) && !AUX.has(q)) take(90, q, entry.tokens.get(q))
      for (const [token, surface] of entry.heads) {
        if (token === q || !token.startsWith(q) || score > 60) continue
        if (score < 60 || token.length < key.length || (token.length === key.length && token.localeCompare(key, 'tr') < 0)) {
          score = 60
          key = token
          label = surface
        }
      }
      if (name.length === 1 && name[0] === q) take(100, name.join(' '), '')
      else if (name.length > 1 && name[0] === q) take(58, name.join(' '), '')
    } else if (needle.length >= 2) {
      if (` ${entry.blob} `.includes(` ${needle} `)) take(entry.blob.startsWith(needle) ? 100 : 96, needle, '')
      const same = name.length === qTokens.length && qTokens.every((part, index) => name[index] === part)
      const prefix =
        qTokens.length >= 2 &&
        qTokens.length <= name.length &&
        qTokens.every((part, index) => (index < qTokens.length - 1 ? name[index] === part : name[index].startsWith(part)))
      if (same) take(100, name.join(' '), '')
      else if (prefix) take(72, name.join(' '), '')
    }
    if (qAr && arabic) {
      if (arabic === qAr) take(100, arabic, '')
      else if (arabic.startsWith(qAr)) take(74, arabic, '')
    }
    if (score) hits.push({ root, score, key, label })
  }
  hits.sort(
    (a, b) => b.score - a.score || a.key.localeCompare(b.key, 'tr') || a.root.latinName.localeCompare(b.root.latinName, 'tr'),
  )
  const head = hits.filter((hit) => hit.score >= 72)
  const tail = hits.filter((hit) => hit.score < 72).slice(0, 40)
  return head.concat(tail)
}

function searchDictionary(query) {
  const hits = rankDictionary(query)
  if (hits.length) return hits
  const stem = queryStem(query)
  if (!stem) return hits
  return rankDictionary(stem)
}

function rootCard(root, found) {
  const done = studied[root.id] ? ' done' : ''
  const preview = root.meaningsPreview || ''
  const visible = found && trTokens(preview).includes(foldTr(found))
  const sub = found && !visible ? `<b class="found">${escapeHtml(found)}</b> — ${escapeHtml(preview)}` : escapeHtml(preview)
  return `
    <li>
      <a class="root-link${done}" href="./root.html?id=${encodeURIComponent(root.id)}">
        <div class="badge" lang="ar" dir="rtl">${escapeHtml(root.lettersArabic || '—')}</div>
        <div>
          <strong>${escapeHtml(root.latinName || root.id)}</strong>
          <p class="sub">${sub}</p>
        </div>
        <div class="count">${root.totalOccurrencesInQuran.toLocaleString(locale())}${studied[root.id] ? `<span class="done-mark">${t('ok')}</span>` : ''}</div>
      </a>
    </li>`
}

async function ensureList(name) {
  if (lists[name]) return lists[name]
  const spec = listTabs[name]
  const res = await fetch(`${CONTENT}/${spec.file}`)
  if (!res.ok) throw new Error(t(spec.error))
  lists[name] = (await res.json())[spec.key]
  return lists[name]
}

function verbCard(item) {
  const meaning = shortMeaning(item.sura, item.ayah, item.formInAyah, item.gloss || item.lemma)
  return `
    <li>
      <a class="root-link" href="./root.html?id=${encodeURIComponent(item.rootId)}">
        <div class="badge" lang="ar" dir="rtl">${escapeHtml(item.formInAyah || item.lemma)}</div>
        <div>
          <strong>${escapeHtml(meaning)}</strong>
          <p class="sub">${escapeHtml(item.latinName || '')}</p>
        </div>
        <div class="count">${item.count.toLocaleString(locale())}</div>
      </a>
    </li>`
}

function progressLine(words, roots) {
  if (lang() === 'en') {
    const word = words === 1 ? 'word' : 'words'
    const root = roots === 1 ? 'root' : 'roots'
    return `${words.toLocaleString('en-US')} ${word} learned · ${roots.toLocaleString('en-US')} ${root}`
  }
  return t('count', {
    words: words.toLocaleString('tr-TR'),
    roots: roots.toLocaleString('tr-TR'),
  })
}

function listBlurb(spec, count) {
  const formatted = count.toLocaleString(locale())
  if (lang() === 'en' && count === 1) {
    return spec.kind === 'verb'
      ? '1 verb. Nouns are not in this list.'
      : '1 noun. Only words that are nouns.'
  }
  return `${formatted} ${t(spec.blurb)}`
}

function readingHits(text, query) {
  if (query.length < 3) return false
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .split(/[^\p{L}\p{M}]+/u)
    .some((token) => token === query || token.startsWith(query))
}

function paint(query) {
  const panel = document.getElementById('panel')
  const empty = document.getElementById('empty')
  const done = studiedCount()
  const ratio = allRoots.length ? Math.round((done / allRoots.length) * 100) : 0
  const words = knownWordCount()
  document.getElementById('count').textContent = progressLine(words, done)
  document.body.dataset.tab = tab

  const q = query.trim().toLocaleLowerCase('tr-TR')
  const input = document.getElementById('q')
  if (tab === 'kuran') {
    if (input) input.placeholder = t('quranSearch')
    paintQuran(panel, query)
    return
  }
  if (input) input.placeholder = t('searchPlaceholder')
  const spec = listTabs[tab]
  if (spec) {
    const rows = (lists[tab] || []).filter((item) => {
      if (!q) return true
      const raw = query.trim()
      return (
        wordHits(item.gloss, q) ||
        wordHits(item.meaning, q) ||
        wordHits(item.latinName, q) ||
        (item.lettersArabic || '').includes(raw) ||
        (item.lemma || '').includes(raw) ||
        (item.formInAyah || '').includes(raw) ||
        readingHits(item.transliteration, q)
      )
    })
    empty.textContent = t(spec.empty)
    empty.classList.toggle('hidden', rows.length > 0)
    panel.innerHTML = `
      <a class="hero-card" href="${spec.href}">
        <div>
          <p class="eyebrow">${t(spec.eyebrow)}</p>
          <strong>${t(spec.title)}</strong>
          <p class="sub">${listBlurb(spec, rows.length)}</p>
        </div>
      </a>
      <ul class="list">${rows.map(verbCard).join('')}</ul>`
    return
  }

  empty.textContent = t('emptyRoots')
  if (q) {
    const found = searchDictionary(query)
    empty.classList.toggle('hidden', found.length > 0)
    panel.innerHTML = `<ul class="list">${found.map((hit) => rootCard(hit.root, hit.label)).join('')}</ul>`
    return
  }

  empty.classList.add('hidden')
  const due = dueWordCount()
  const lessonCard = `
    <a class="hero-card" href="./lesson.html">
      <div>
        <p class="eyebrow">${t('lessonEyebrow')}</p>
        <strong>${due ? t('lessonDue') : t('lessonStudy')}</strong>
        <p class="sub">${due ? t('lessonDueBlurb', { n: due.toLocaleString(locale()) }) : t('lessonStudyBlurb')}</p>
      </div>
      <span class="go" aria-hidden="true"></span>
    </a>`
  const continueCard = last
    ? `<a class="quiet-card" href="./root.html?id=${encodeURIComponent(last.id)}">
         <div>
           <p class="eyebrow">${t('continueEyebrow')}</p>
           <strong>${escapeHtml(last.latinName)}</strong>
           <p class="sub">${t('continueBlurb')}</p>
         </div>
         <div class="ar" lang="ar">${escapeHtml(last.lettersArabic)}</div>
         <span class="go" aria-hidden="true"></span>
       </a>`
    : ''

  if (!letter) {
    panel.innerHTML = `
      ${lessonCard}
      ${continueCard}
      <div class="progress">
        <span>${t('progress')}</span>
        <span>${ratio}%</span>
      </div>
      <div class="bar" aria-hidden="true"><span style="width:${ratio}%"></span></div>
      <div class="section-head"><h2>${t('letters')}</h2></div>
      <div class="letters">
        ${letters
          .map(
            (item) =>
              `<button type="button" data-letter="${escapeHtml(item)}">${escapeHtml(item)}<small>${byLetter.get(item).length}</small></button>`,
          )
          .join('')}
      </div>`
    panel.querySelectorAll('[data-letter]').forEach((button) => {
      button.addEventListener('click', () => {
        letter = button.getAttribute('data-letter') || ''
        paint('')
      })
    })
    return
  }

  const rows = byLetter.get(letter) || []
  panel.innerHTML = `
    <div class="section-head">
      <h2><span lang="ar" dir="rtl">${escapeHtml(letter)}</span> · ${t('letterCount', { n: rows.length })}</h2>
      <button type="button" class="text-btn" id="back-letters">${t('backLetters')}</button>
    </div>
    <ul class="list">${rows.map(rootCard).join('')}</ul>`
  document.getElementById('back-letters').addEventListener('click', () => {
    letter = ''
    paint('')
  })
}

function applyChrome() {
  applyLang()
  document.title = t('homeTitle')
  const brand = document.getElementById('brand')
  if (brand) brand.textContent = t('brand')
  const label = document.querySelector('.search .sr-only')
  if (label) label.textContent = t('searchLabel')
  const input = document.getElementById('q')
  if (input) input.placeholder = t('searchPlaceholder')
  const shareAppButton = document.getElementById('share-app')
  if (shareAppButton && shareAppButton.dataset.busy !== '1') shareAppButton.textContent = t('share')
  const names = { sozluk: 'dict', fiiller: 'verbs', isimler: 'nouns', kuran: 'quran' }
  for (const [id, key] of Object.entries(names)) {
    const button = document.getElementById(`tab-${id}`)
    if (button) button.textContent = t(key)
  }
}

applyChrome()
paint('')

function copyAppLink() {
  const area = document.createElement('textarea')
  area.value = APP_URL
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.focus()
  area.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  area.remove()
  return copied
}

function showAppLink() {
  document.getElementById('share-preview')?.remove()
  const wrap = document.createElement('div')
  wrap.id = 'share-preview'
  wrap.innerHTML = `<div class="share-sheet"><p class="app-link">${APP_URL}</p><button type="button" class="share-close">${t('close')}</button></div>`
  wrap.addEventListener('click', (event) => {
    if (event.target === wrap || event.target.closest('.share-close')) wrap.remove()
  })
  document.body.appendChild(wrap)
}

function flashShare(button, label) {
  button.dataset.busy = '1'
  button.textContent = label
  setTimeout(() => {
    button.dataset.busy = ''
    button.textContent = t('share')
  }, 1600)
}

document.getElementById('share-app').addEventListener('click', async () => {
  const button = document.getElementById('share-app')
  const payload = { title: t('homeTitle'), text: t('shareAppText'), url: APP_URL }
  if (navigator.share) {
    try {
      await navigator.share(payload)
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(APP_URL)
    flashShare(button, t('shareCopied'))
    return
  } catch {
    /* Bilgisayar panosu kapalıysa adres kartı açılır. */
  }
  if (copyAppLink()) {
    flashShare(button, t('shareCopied'))
    return
  }
  showAppLink()
})

document.getElementById('q').addEventListener('input', (event) => {
  letter = ''
  paint(event.target.value)
})

document.getElementById('tabs').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-tab]')
  if (!button) return
  const next = button.getAttribute('data-tab') || 'sozluk'
  if (tab === 'kuran' && next !== 'kuran') stopReading()
  if (next === 'kuran') document.getElementById('q').value = ''
  tab = next
  document.querySelectorAll('#tabs button').forEach((item) => {
    item.classList.toggle('on', item === button)
  })
  if (listTabs[tab]) {
    try {
      await ensureList(tab)
    } catch (err) {
      document.getElementById('error').classList.remove('hidden')
      document.getElementById('error').textContent = err.message
      return
    }
  }
  paint(document.getElementById('q').value)
})

window.addEventListener('pageshow', () => {
  const fresh = readState().studied
  for (const key of Object.keys(studied)) delete studied[key]
  Object.assign(studied, fresh)
  paint(document.getElementById('q').value)
})
