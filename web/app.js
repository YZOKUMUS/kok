import { readState, studiedCount } from './study.js'

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
const state = readState()
const studied = state.studied
const last = allRoots.find((root) => root.id === state.lastId) || null
const pool = allRoots.filter((root) => !studied[root.id])
const practice = (pool.length ? pool : allRoots)[Math.floor(Math.random() * Math.max(allRoots.length, 1))] || null

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

function paint(query) {
  const panel = document.getElementById('panel')
  const empty = document.getElementById('empty')
  const done = studiedCount()
  const ratio = allRoots.length ? Math.round((done / allRoots.length) * 100) : 0
  document.getElementById('count').textContent =
    `${done.toLocaleString('tr-TR')} / ${allRoots.length.toLocaleString('tr-TR')} kök çalışıldı`

  const q = query.trim().toLocaleLowerCase('tr-TR')
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
  const continueCard = last
    ? `<a class="hero-card" href="./root.html?id=${encodeURIComponent(last.id)}">
         <div>
           <p class="eyebrow">Kaldığın yer</p>
           <strong>${escapeHtml(last.latinName)}</strong>
           <p class="sub">Kaldığın kökü aç</p>
         </div>
         <div class="hero-ar" lang="ar">${escapeHtml(last.lettersArabic)}</div>
       </a>`
    : ''
  const practiceCard = practice
    ? `<a class="quiet-card" href="./root.html?id=${encodeURIComponent(practice.id)}">
         <div>
           <p class="eyebrow">Bugün</p>
           <strong>${escapeHtml(practice.latinName || practice.id)}</strong>
           <p class="sub">${escapeHtml(practice.meaningsPreview || '')}</p>
         </div>
         <div class="ar" lang="ar">${escapeHtml(practice.lettersArabic || '')}</div>
       </a>`
    : ''

  if (!letter) {
    panel.innerHTML = `
      ${continueCard}
      ${practiceCard}
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

window.addEventListener('pageshow', () => {
  const fresh = readState().studied
  for (const key of Object.keys(studied)) delete studied[key]
  Object.assign(studied, fresh)
  paint(document.getElementById('q').value)
})
