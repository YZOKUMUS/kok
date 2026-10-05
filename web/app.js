import { shortMeaning } from './gloss.js?v=6'
import { applyLang, lang, locale, t } from './i18n.js?v=10'
import { paintQuran, stopReading } from './read.js?v=3'
import { dueWordCount, knownWordCount, readState, studiedCount } from './study.js'

const CONTENT = '../content'
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

function rootCard(root) {
  const done = studied[root.id] ? ' done' : ''
  return `
    <li>
      <a class="root-link${done}" href="./root.html?id=${encodeURIComponent(root.id)}">
        <div class="badge" lang="ar" dir="rtl">${escapeHtml(root.lettersArabic || '—')}</div>
        <div>
          <strong>${escapeHtml(root.latinName || root.id)}</strong>
          <p class="sub">${escapeHtml(root.meaningsPreview || '')}</p>
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
      return (
        (item.gloss || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (item.meaning || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (item.latinName || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (item.lettersArabic || '').includes(query.trim()) ||
        (item.lemma || '').includes(query.trim()) ||
        (item.formInAyah || '').includes(query.trim()) ||
        (item.transliteration || '').toLocaleLowerCase('tr-TR').includes(q)
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
    const filtered = allRoots.filter(
      (root) =>
        (root.latinName || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (root.lettersArabic || '').includes(query.trim()) ||
        (root.id || '').toLowerCase().includes(q) ||
        (root.meaningsPreview || '').toLocaleLowerCase('tr-TR').includes(q),
    )
    empty.classList.toggle('hidden', filtered.length > 0)
    panel.innerHTML = `<ul class="list">${filtered.map(rootCard).join('')}</ul>`
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
    </a>`
  const continueCard = last
    ? `<a class="quiet-card" href="./root.html?id=${encodeURIComponent(last.id)}">
         <div>
           <p class="eyebrow">${t('continueEyebrow')}</p>
           <strong>${escapeHtml(last.latinName)}</strong>
           <p class="sub">${t('continueBlurb')}</p>
         </div>
         <div class="ar" lang="ar">${escapeHtml(last.lettersArabic)}</div>
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
  const names = { sozluk: 'dict', fiiller: 'verbs', isimler: 'nouns', kuran: 'quran' }
  for (const [id, key] of Object.entries(names)) {
    const button = document.getElementById(`tab-${id}`)
    if (button) button.textContent = t(key)
  }
}

applyChrome()
paint('')

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
