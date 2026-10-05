import { playVerse, stopPlayback, whenEnded } from './audio.js?v=8'
import { lang, t } from './i18n.js?v=10'
import { SURAHS } from './surahs.js?v=1'
import { loadUthmani } from './verses.js'
import { tokenHits, wordHits } from './words.js?v=1'

const PLACE = 'kh-read'
const VERSE_CAP = 40
let verses = null
let meals = null
let mealPromise = null
let sura = 1
let ayah = 1
let playing = false
let done = false
let view = 'list'
let token = 0

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function surahAt(id) {
  return SURAHS[id - 1]
}

export function surahLabel(id) {
  const row = surahAt(id)
  if (!row) return ''
  return lang() === 'en' ? row.en : row.tr
}

export function savedPlace() {
  const [s, a] = (localStorage.getItem(PLACE) || '').split(':').map(Number)
  if (s >= 1 && s <= 114 && a >= 1 && a <= surahAt(s).ayahs) return { sura: s, ayah: a }
  return null
}

function remember() {
  localStorage.setItem(PLACE, `${sura}:${ayah}`)
}

function warmText() {
  if (!verses) {
    verses = loadUthmani().catch(() => {
      verses = null
      return {}
    })
  }
  return verses
}

function textAt(s, a) {
  return verses && typeof verses.then !== 'function' ? verses[`${s}:${a}`] || '' : ''
}

function loadMeals() {
  if (!mealPromise) {
    mealPromise = fetch('../content/meals.json')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        meals = data
        return data
      })
      .catch(() => {
        mealPromise = null
        return {}
      })
  }
  return mealPromise
}

function verseHits(book, query) {
  const hits = []
  for (const key of Object.keys(book)) {
    const meal = book[key]
    if (!wordHits(meal, query)) continue
    const [suraNo, ayahNo] = key.split(':').map(Number)
    hits.push({ sura: suraNo, ayah: ayahNo, meal })
  }
  return hits
}

function markMeal(text, query) {
  return text
    .split(/([^a-zA-ZçğıöşüâîûÇĞİÖŞÜÂÎÛ]+)/)
    .map((part) => {
      if (!part) return ''
      if (!/[a-zA-ZçğıöşüâîûÇĞİÖŞÜÂÎÛ]/.test(part)) return escapeHtml(part)
      const hit = tokenHits(part.toLocaleLowerCase('tr-TR'), query)
      return hit ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)
    })
    .join('')
}

function step() {
  const row = surahAt(sura)
  if (ayah < row.ayahs) {
    ayah += 1
    return true
  }
  if (sura < 114) {
    sura += 1
    ayah = 1
    return true
  }
  return false
}

function notify() {
  if (document.body.dataset.tab !== 'kuran') return
  const panel = document.getElementById('panel')
  if (panel && view === 'read') renderReader(panel)
}

async function playCurrent(mine) {
  remember()
  notify()
  try {
    await playVerse(sura, ayah)
  } catch {
    playing = false
    notify()
    return
  }
  if (mine !== token || !playing) return
  whenEnded(() => {
    if (mine !== token || !playing) return
    if (!step()) {
      playing = false
      done = true
      remember()
      notify()
      return
    }
    done = false
    playCurrent(mine)
  })
}

export async function startAt(nextSura, nextAyah) {
  await warmText()
  if (verses && typeof verses.then === 'function') verses = await verses
  sura = nextSura
  ayah = nextAyah
  playing = true
  done = false
  view = 'read'
  token += 1
  await playCurrent(token)
}

export function pauseReading() {
  playing = false
  token += 1
  stopPlayback()
  notify()
}

export function stopReading() {
  if (!playing) return
  pauseReading()
}

function renderList(panel, query) {
  panel.dataset.read = ''
  const needle = query.trim()
  const folded = needle.toLocaleLowerCase('tr-TR')
  const rows = SURAHS.filter((row) => {
    if (!folded) return true
    return (
      row.tr.toLocaleLowerCase('tr-TR').includes(folded) ||
      row.en.toLocaleLowerCase('en').includes(folded) ||
      row.ar.includes(needle) ||
      String(row.id) === needle
    )
  })
  const saved = savedPlace()
  const resume =
    saved && !(saved.sura === 1 && saved.ayah === 1)
      ? `<button type="button" class="btn read-start" id="read-resume">${t('quranResume')} · ${escapeHtml(surahLabel(saved.sura))} ${saved.ayah}</button>`
      : ''
  const empty = document.getElementById('empty')
  empty.textContent = t('quranEmpty')
  empty.classList.toggle('hidden', rows.length > 0)
  panel.innerHTML = `
    <button type="button" class="btn-listen read-start" id="read-start">${t('quranStart')}</button>
    <p class="sub read-blurb">${t('quranBlurb')}</p>
    ${resume}
    <ul class="list surah-list">
      ${rows
        .map((row) => {
          const here = saved && saved.sura === row.id ? ' on' : ''
          const name = lang() === 'en' ? row.en : row.tr
          return `<li><button type="button" class="surah-row${here}" data-sura="${row.id}">
            <span class="no">${row.id}</span>
            <span><strong>${escapeHtml(name)}</strong><small>${t('quranAyahs', { n: row.ayahs })}</small></span>
            <span class="ar" lang="ar">${row.ar}</span>
          </button></li>`
        })
        .join('')}
    </ul>`
  document.getElementById('read-start')?.addEventListener('click', () => startAt(1, 1))
  document.getElementById('read-resume')?.addEventListener('click', () => startAt(saved.sura, saved.ayah))
  panel.querySelectorAll('[data-sura]').forEach((button) => {
    button.addEventListener('click', () => startAt(Number(button.dataset.sura), 1))
  })
}

function renderReader(panel) {
  const same = panel.dataset.read === String(sura) && panel.querySelector('.read-list')
  if (!same) {
    const row = surahAt(sura)
    const items = []
    for (let n = 1; n <= row.ayahs; n += 1) {
      items.push(
        `<li><button type="button" class="read-verse" data-ayah="${n}" id="read-${sura}-${n}"><span class="n">${n}</span><span class="tx" lang="ar">${escapeHtml(textAt(sura, n))}</span></button></li>`,
      )
    }
    panel.dataset.read = String(sura)
    panel.innerHTML = `
      <div class="read-bar">
        <button type="button" class="text-btn" id="read-back">${t('quranSurahs')}</button>
        <strong>${escapeHtml(surahLabel(sura))}</strong>
        <button type="button" class="text-btn" id="read-toggle">${playing ? t('quranPause') : t('quranPlay')}</button>
      </div>
      <p class="sub read-blurb" id="read-note">${done ? t('quranDone') : ''}</p>
      <ol class="read-list">${items.join('')}</ol>`
    document.getElementById('empty')?.classList.add('hidden')
    document.getElementById('read-back')?.addEventListener('click', () => {
      view = 'list'
      const query = document.getElementById('q')?.value.trim() || ''
      if (query) renderSearch(panel, query, meals)
      else renderList(panel, '')
    })
    document.getElementById('read-toggle')?.addEventListener('click', () => {
      if (playing) pauseReading()
      else startAt(sura, ayah)
    })
    panel.querySelectorAll('[data-ayah]').forEach((button) => {
      button.addEventListener('click', () => startAt(sura, Number(button.dataset.ayah)))
    })
  }
  const toggle = document.getElementById('read-toggle')
  if (toggle) toggle.textContent = playing ? t('quranPause') : t('quranPlay')
  const note = document.getElementById('read-note')
  if (note) note.textContent = done ? t('quranDone') : `${sura}:${ayah}`
  panel.querySelectorAll('.read-verse.on').forEach((item) => item.classList.remove('on'))
  const current = document.getElementById(`read-${sura}-${ayah}`)
  if (current) {
    current.classList.add('on')
    current.scrollIntoView({ block: ayah === 1 ? 'nearest' : 'center', behavior: 'smooth' })
  }
}

function renderSearch(panel, query, book) {
  panel.dataset.read = ''
  const folded = query.toLocaleLowerCase('tr-TR')
  const surahs = SURAHS.filter(
    (row) =>
      row.tr.toLocaleLowerCase('tr-TR').includes(folded) ||
      row.en.toLocaleLowerCase('en').includes(folded) ||
      row.ar.includes(query) ||
      String(row.id) === query,
  )
  const hits = book ? verseHits(book, folded) : []
  const shown = hits.slice(0, VERSE_CAP)
  const empty = document.getElementById('empty')
  const waiting = !book
  empty.textContent = t('quranEmpty')
  empty.classList.toggle('hidden', waiting || surahs.length > 0 || hits.length > 0)
  const versesHtml = waiting
    ? `<p class="sub">${t('quranSearching')}</p>`
    : hits.length
      ? `<p class="meal-head">${t('quranVerseHead', { n: hits.length })}</p>
        <ul class="list meal-list">
          ${shown
            .map(
              (hit) => `<li><button type="button" class="meal-row" data-sura="${hit.sura}" data-ayah="${hit.ayah}">
                <span class="no">${hit.sura}:${hit.ayah}</span>
                <span class="meal">${markMeal(hit.meal, folded)}</span>
              </button></li>`,
            )
            .join('')}
        </ul>
        ${hits.length > shown.length ? `<p class="sub">${t('quranMore', { n: hits.length - shown.length })}</p>` : ''}`
      : ''
  const surahHtml = surahs.length
    ? `<ul class="list surah-list">
        ${surahs
          .map((row) => {
            const name = lang() === 'en' ? row.en : row.tr
            return `<li><button type="button" class="surah-row" data-sura="${row.id}" data-ayah="1">
              <span class="no">${row.id}</span>
              <span><strong>${escapeHtml(name)}</strong><small>${t('quranAyahs', { n: row.ayahs })}</small></span>
              <span class="ar" lang="ar">${row.ar}</span>
            </button></li>`
          })
          .join('')}
      </ul>`
    : ''
  panel.innerHTML = `${versesHtml}${surahHtml}`
  panel.querySelectorAll('[data-sura]').forEach((button) => {
    button.addEventListener('click', () => startAt(Number(button.dataset.sura), Number(button.dataset.ayah || 1)))
  })
}

export function paintQuran(panel, query) {
  warmText()
  const needle = query.trim()
  if (needle) {
    view = 'list'
    if (meals) renderSearch(panel, needle, meals)
    else {
      renderSearch(panel, needle, null)
      loadMeals().then((book) => {
        if (document.body.dataset.tab !== 'kuran') return
        const current = document.getElementById('q')?.value.trim() || ''
        if (current !== needle) return
        renderSearch(panel, needle, book)
      })
    }
    return
  }
  if (view === 'read') renderReader(panel)
  else renderList(panel, '')
}
