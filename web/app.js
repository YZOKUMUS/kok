import { shortMeaning } from './gloss.js?v=6'
import { applyLang, lang, locale, t } from './i18n.js?v=16'
import { loadMeals, paintQuran, parkReader, quranSearchBlock, startAt, stopReading } from './read.js?v=8'
import { queryStem, tokenHits } from './words.js?v=2'
import { dueWordCount, knownWordCount, readState, studiedCount } from './study.js'
import { watchVisits } from './visits.js?v=4'

const CONTENT = '../content'
const APP_URL = 'https://kok-calis.web.app/'
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
const listPromises = {
  fiiller: null,
  isimler: null,
}
const listErrors = {
  fiiller: false,
  isimler: false,
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
    if (input && input.value.trim()) paint(input.value)
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

function ensureList(name) {
  if (lists[name]) return Promise.resolve(lists[name])
  if (!listPromises[name]) {
    const spec = listTabs[name]
    listPromises[name] = fetch(`${CONTENT}/${spec.file}`)
      .then((res) => {
        if (!res.ok) throw new Error(t(spec.error))
        return res.json()
      })
      .then((data) => {
        const rows = data[spec.key]
        for (const item of rows) {
          item.searchTokens = itemTokens(item)
          item.searchArabic = itemArabic(item)
        }
        lists[name] = rows
        listErrors[name] = false
        return rows
      })
      .catch((err) => {
        listErrors[name] = true
        throw err
      })
      .finally(() => {
        listPromises[name] = null
      })
  }
  return listPromises[name]
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

const FIND_CAP = 12
let findToken = 0

const TRANSLIT = {
  ā: 'a',
  á: 'a',
  ǎ: 'a',
  ē: 'e',
  é: 'e',
  ě: 'e',
  ī: 'i',
  í: 'i',
  ǐ: 'i',
  ō: 'o',
  ú: 'u',
  ǔ: 'u',
  ū: 'u',
  ḍ: 'd',
  ḏ: 'd',
  ḥ: 'h',
  ḣ: 'h',
  ḳ: 'k',
  ṣ: 's',
  ṧ: 's',
  š: 's',
  ṭ: 't',
  ṯ: 't',
  ẓ: 'z',
  ƶ: 'z',
  ž: 'z',
  ġ: 'g',
  ǧ: 'g',
}

function latinKey(value) {
  return foldTr(value).replace(/[^\x20-\x7E]/g, (ch) => TRANSLIT[ch] || ch)
}

function itemTokens(item) {
  return trTokens(
    [item.gloss, item.meaning, item.latinName, latinKey(item.transliteration)]
      .filter(Boolean)
      .join(' '),
  )
}

function itemArabic(item) {
  return arKey([item.lettersArabic, item.lemma, item.formInAyah].filter(Boolean).join(' '))
}

function sameWord(item, words, arabic) {
  if (words.length) {
    const tokens = item.searchTokens || itemTokens(item)
    return words.every((part) => tokens.some((token) => tokenHits(token, part)))
  }
  if (arabic.length >= 2) return (item.searchArabic || itemArabic(item)).includes(arabic)
  return false
}

function moreNote(total, shown) {
  const rest = total - shown
  if (rest <= 0) return ''
  return `<p class="sub">${t('findMore', { n: rest.toLocaleString(locale()) })}</p>`
}

function findSection(title, total, inner, kind) {
  if (!total) return ''
  const mark = kind ? ` data-find="${kind}"` : ''
  return `<section class="find-block"${mark}><h2>${escapeHtml(title)} <span>${total.toLocaleString(locale())}</span></h2>${inner}</section>`
}

function noteSection(title, note, kind) {
  const mark = kind ? ` data-find="${kind}"` : ''
  return `<section class="find-block"${mark}><h2>${escapeHtml(title)}</h2><p class="sub">${escapeHtml(note)}</p></section>`
}

function listSection(name, key, rows) {
  if (!rows) return noteSection(t(name), listErrors[key] ? t(listTabs[key].error) : t('findWait'), key)
  const shown = rows.slice(0, FIND_CAP)
  return findSection(
    t(name),
    rows.length,
    `<ul class="list">${shown.map(verbCard).join('')}</ul>${moreNote(rows.length, shown.length)}`,
    key,
  )
}

function openReading(suraNo, ayahNo) {
  if (tab !== 'kuran') stopReading()
  findToken += 1
  tab = 'kuran'
  document.body.dataset.tab = 'kuran'
  document.querySelectorAll('#tabs button').forEach((item) => {
    item.classList.toggle('on', item.getAttribute('data-tab') === 'kuran')
  })
  const input = document.getElementById('q')
  if (input) input.value = ''
  startAt(suraNo, ayahNo)
}

function renderCombined(query, quran) {
  parkReader()
  const panel = document.getElementById('panel')
  panel.dataset.read = ''
  const empty = document.getElementById('empty')
  const words = trTokens(query)
  const arabic = arKey(query)
  const match = (item) => sameWord(item, words, arabic)
  const roots = searchDictionary(query)
  const verbs = lists.fiiller ? lists.fiiller.filter(match) : null
  const nouns = lists.isimler ? lists.isimler.filter(match) : null
  const search = quran || quranSearchBlock(query, FIND_CAP)
  const rootShown = roots.slice(0, FIND_CAP)
  const html = [
    findSection(
      t('dict'),
      roots.length,
      `<ul class="list">${rootShown.map((hit) => rootCard(hit.root, hit.label)).join('')}</ul>${moreNote(roots.length, rootShown.length)}`,
      'sozluk',
    ),
    listSection('verbs', 'fiiller', verbs),
    listSection('nouns', 'isimler', nouns),
    search.count || search.waiting || search.failed
      ? `<section class="find-block find-quran" data-find="kuran"><h2>${escapeHtml(t('quran'))}${search.waiting || search.failed ? '' : ` <span>${search.count.toLocaleString(locale())}</span>`}</h2>${search.html}</section>`
      : '',
  ].join('')
  const pending = (!verbs && !listErrors.fiiller) || (!nouns && !listErrors.isimler) || search.waiting
  const any = roots.length || (verbs && verbs.length) || (nouns && nouns.length) || search.count
  empty.textContent = t('findEmpty')
  empty.classList.toggle('hidden', pending || Boolean(any))
  panel.innerHTML = html
  panel.querySelectorAll('.find-quran [data-sura]').forEach((button) => {
    button.addEventListener('click', () => openReading(Number(button.dataset.sura), Number(button.dataset.ayah || 1)))
  })
}

function paintCombined(query) {
  const mine = ++findToken
  const quran = quranSearchBlock(query, FIND_CAP)
  renderCombined(query, quran)
  const jobs = []
  if (!lists.fiiller && !listErrors.fiiller) jobs.push(ensureList('fiiller'))
  if (!lists.isimler && !listErrors.isimler) jobs.push(ensureList('isimler'))
  if (quran.waiting) jobs.push(loadMeals())
  if (!jobs.length) return
  Promise.allSettled(jobs).then(() => {
    if (mine !== findToken) return
    const current = document.getElementById('q')?.value.trim() || ''
    if (current !== query.trim()) return
    document.getElementById('error').classList.add('hidden')
    renderCombined(current, quranSearchBlock(current, FIND_CAP))
  })
}

function paint(query) {
  const panel = document.getElementById('panel')
  const empty = document.getElementById('empty')
  const done = studiedCount()
  const ratio = allRoots.length ? Math.round((done / allRoots.length) * 100) : 0
  const words = knownWordCount()
  document.getElementById('count').textContent = progressLine(words, done)
  document.body.dataset.tab = tab

  const input = document.getElementById('q')
  if (input) input.placeholder = t('searchPlaceholder')
  const typed = query.trim()
  if (typed) {
    paintCombined(typed)
    return
  }
  if (tab === 'kuran') {
    paintQuran(panel, '')
    return
  }
  const spec = listTabs[tab]
  if (spec) {
    const rows = lists[tab] || []
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
    await navigator.clipboard.writeText(`${payload.text}\n${APP_URL}`)
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

function scrollToFind(name) {
  const block = document.querySelector(`.find-block[data-find="${name}"]`)
  if (!block) return
  const head = document.querySelector('.sticky-head')
  const top = block.getBoundingClientRect().top + window.scrollY - (head?.offsetHeight || 0) - 8
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

document.getElementById('tabs').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-tab]')
  if (!button) return
  const next = button.getAttribute('data-tab') || 'sozluk'
  if (tab === 'kuran' && next !== 'kuran') stopReading()
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
  const query = document.getElementById('q').value
  paint(query)
  if (query.trim()) scrollToFind(tab)
})

watchVisits()

window.addEventListener('pageshow', () => {
  const fresh = readState().studied
  for (const key of Object.keys(studied)) delete studied[key]
  Object.assign(studied, fresh)
  paint(document.getElementById('q').value)
})
