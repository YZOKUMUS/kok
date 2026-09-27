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
  if (!res.ok) throw new Error(`İndeks yüklenemedi (${res.status})`)
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
    error: 'Fiil listesi yüklenemedi',
    empty: 'Bu aramada fiil yok.',
    href: './lesson.html?fiil=1',
    eyebrow: 'Fiil dersi',
    title: 'Yalnızca fiilleri çalış',
    blurb: 'fiil. İsimler bu listede yok.',
  },
  isimler: {
    file: 'nouns.json',
    key: 'nouns',
    error: 'İsim listesi yüklenemedi',
    empty: 'Bu aramada isim yok.',
    href: './lesson.html?isim=1',
    eyebrow: 'İsim dersi',
    title: 'Yalnızca isimleri çalış',
    blurb: 'isim. Yalnızca isim olan kelimeler.',
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
        <div class="count">${root.totalOccurrencesInQuran.toLocaleString('tr-TR')}${studied[root.id] ? '<span class="done-mark">ok</span>' : ''}</div>
      </a>
    </li>`
}

async function ensureList(name) {
  if (lists[name]) return lists[name]
  const spec = listTabs[name]
  const res = await fetch(`${CONTENT}/${spec.file}`)
  if (!res.ok) throw new Error(spec.error)
  lists[name] = (await res.json())[spec.key]
  return lists[name]
}

function verbCard(item) {
  return `
    <li>
      <a class="root-link" href="./root.html?id=${encodeURIComponent(item.rootId)}">
        <div class="badge" lang="ar" dir="rtl">${escapeHtml(item.formInAyah || item.lemma)}</div>
        <div>
          <strong>${escapeHtml(item.gloss || item.lemma)}</strong>
          <p class="sub">${escapeHtml(item.latinName || '')}</p>
        </div>
        <div class="count">${item.count.toLocaleString('tr-TR')}</div>
      </a>
    </li>`
}

function paint(query) {
  const panel = document.getElementById('panel')
  const empty = document.getElementById('empty')
  const done = studiedCount()
  const ratio = allRoots.length ? Math.round((done / allRoots.length) * 100) : 0
  const words = knownWordCount()
  document.getElementById('count').textContent =
    `${words.toLocaleString('tr-TR')} kelime öğrenildi · ${done.toLocaleString('tr-TR')} kök`

  const q = query.trim().toLocaleLowerCase('tr-TR')
  const spec = listTabs[tab]
  if (spec) {
    const rows = (lists[tab] || []).filter((item) => {
      if (!q) return true
      return (
        (item.gloss || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (item.latinName || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (item.lemma || '').includes(query.trim()) ||
        (item.formInAyah || '').includes(query.trim()) ||
        (item.transliteration || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
    empty.textContent = spec.empty
    empty.classList.toggle('hidden', rows.length > 0)
    panel.innerHTML = `
      <a class="hero-card" href="${spec.href}">
        <div>
          <p class="eyebrow">${spec.eyebrow}</p>
          <strong>${spec.title}</strong>
          <p class="sub">${rows.length.toLocaleString('tr-TR')} ${spec.blurb}</p>
        </div>
      </a>
      <ul class="list">${rows.map(verbCard).join('')}</ul>`
    return
  }

  empty.textContent = 'Bu aramada kök yok.'
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
        <p class="eyebrow">Ders</p>
        <strong>${due ? 'Tekrar zamanı' : 'Kelime çalış'}</strong>
        <p class="sub">${due ? `${due.toLocaleString('tr-TR')} kelime seni bekliyor` : 'Önce kelime, sonra anlam. Günde bir avuç.'}</p>
      </div>
    </a>`
  const continueCard = last
    ? `<a class="quiet-card" href="./root.html?id=${encodeURIComponent(last.id)}">
         <div>
           <p class="eyebrow">Sözlük</p>
           <strong>${escapeHtml(last.latinName)}</strong>
           <p class="sub">Kökün anlamı ve ayetleri</p>
         </div>
         <div class="ar" lang="ar">${escapeHtml(last.lettersArabic)}</div>
       </a>`
    : ''

  if (!letter) {
    panel.innerHTML = `
      ${lessonCard}
      ${continueCard}
      <div class="progress">
        <span>İlerleme</span>
        <span>${ratio}%</span>
      </div>
      <div class="bar" aria-hidden="true"><span style="width:${ratio}%"></span></div>
      <div class="section-head"><h2>Harften başla</h2></div>
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
      <h2><span lang="ar" dir="rtl">${escapeHtml(letter)}</span> · ${rows.length} kök</h2>
      <button type="button" class="text-btn" id="back-letters">Harfler</button>
    </div>
    <ul class="list">${rows.map(rootCard).join('')}</ul>`
  document.getElementById('back-letters').addEventListener('click', () => {
    letter = ''
    paint('')
  })
}

paint('')

document.getElementById('q').addEventListener('input', (event) => {
  letter = ''
  paint(event.target.value)
})

document.getElementById('tabs').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-tab]')
  if (!button) return
  tab = button.getAttribute('data-tab') || 'sozluk'
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
