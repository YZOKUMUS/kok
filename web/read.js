import { playVerse, stopPlayback, whenEnded } from './audio.js?v=8'
import { lang, locale, t } from './i18n.js?v=18'
import { SURAHS } from './surahs.js?v=1'
import { loadUthmani } from './verses.js'
import { tokenHits } from './words.js?v=2'

const PLACE = 'kh-read'
const VERSE_CAP = 40
let verses = null
let meals = null
let mealPromise = null
let mealIndex = null
let mealsFailed = false
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

export function loadMeals() {
  if (!mealPromise) {
    mealPromise = fetch('../content/meals.json?v=2')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('meals'))))
      .then((data) => {
        meals = data
        mealIndex = indexMeals(data)
        return data
      })
      .catch(() => {
        meals = {}
        mealIndex = []
        mealsFailed = true
        return meals
      })
  }
  return mealPromise
}

function foldText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('â', 'a')
    .replaceAll('î', 'i')
    .replaceAll('û', 'u')
}

function textTokens(value) {
  return foldText(value)
    .split(/[^a-zçğıöşü]+/)
    .filter(Boolean)
}

function indexMeals(book) {
  const rows = []
  for (const [key, meal] of Object.entries(book || {})) {
    const [suraNo, ayahNo] = key.split(':').map(Number)
    rows.push({ sura: suraNo, ayah: ayahNo, meal, tokens: textTokens(meal) })
  }
  return rows
}

function verseHits(book, query) {
  const words = textTokens(query)
  if (!words.length) return []
  const rows = book === meals && mealIndex ? mealIndex : indexMeals(book)
  const hits = []
  for (const row of rows) {
    if (!words.every((word) => row.tokens.some((token) => tokenHits(token, word)))) continue
    const prev = hits.at(-1)
    if (prev && prev.sura === row.sura && prev.meal === row.meal) continue
    hits.push(row)
  }
  return hits
}

function markMeal(text, query) {
  const words = textTokens(query)
  return text
    .split(/([^a-zA-ZçğıöşüâîûÇĞİÖŞÜÂÎÛ]+)/)
    .map((part) => {
      if (!part) return ''
      if (!/[a-zA-ZçğıöşüâîûÇĞİÖŞÜÂÎÛ]/.test(part)) return escapeHtml(part)
      const token = foldText(part)
      const hit = words.some((word) => tokenHits(token, word))
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

export function parkReader() {
  view = 'list'
}

export function quranSearchBlock(query, cap) {
  const needle = query.trim()
  const folded = foldText(needle)
  const named = folded.length >= 2
  const surahs = SURAHS.filter(
    (row) =>
      (named &&
        (foldText(row.tr).includes(folded) ||
          row.en.toLocaleLowerCase('en').includes(folded) ||
          row.ar.includes(needle))) ||
      String(row.id) === needle,
  )
  const waiting = !meals
  const hits = meals && named ? verseHits(meals, folded) : []
  const shown = hits.slice(0, cap)
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
  const verseHtml = mealsFailed
    ? `<p class="sub">${t('quranError')}</p>`
    : waiting
      ? `<p class="sub">${t('quranSearching')}</p>`
      : shown.length
        ? `<ul class="list meal-list">
            ${shown
              .map(
                (hit) => `<li><button type="button" class="meal-row" data-sura="${hit.sura}" data-ayah="${hit.ayah}">
                  <span class="no">${hit.sura}:${hit.ayah}</span>
                  <span class="meal">${markMeal(hit.meal, folded)}</span>
                </button></li>`,
              )
              .join('')}
          </ul>
          ${hits.length > shown.length ? `<p class="sub">${t('findMore', { n: (hits.length - shown.length).toLocaleString(lang() === 'en' ? 'en-US' : 'tr-TR') })}</p>` : ''}`
        : ''
  return {
    waiting,
    failed: mealsFailed,
    count: surahs.length + (waiting ? 0 : hits.length),
    html: `${surahHtml}${verseHtml}`,
  }
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
      ? `<button type="button" class="btn" id="read-resume">${t('quranResume')} · ${escapeHtml(surahLabel(saved.sura))} ${saved.ayah}</button>`
      : ''
  const empty = document.getElementById('empty')
  empty.textContent = t('quranEmpty')
  empty.classList.toggle('hidden', rows.length > 0)
  panel.innerHTML = `
    <section class="quran-hero">
      <div>
        <p class="eyebrow">${escapeHtml(t('quran'))}</p>
        <h1>${escapeHtml(t('quranRead'))}</h1>
        <p class="sub">${escapeHtml(t('quranBlurb'))}</p>
      </div>
      <div class="quran-actions">
        <button type="button" class="btn btn-main" id="read-start">${escapeHtml(t('quranStart'))}</button>
        ${resume}
      </div>
    </section>
    <div class="section-head">
      <h2>${escapeHtml(t('quranSurahs'))}</h2>
      <span class="hint">${rows.length.toLocaleString(locale())}</span>
    </div>
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
  if (!meals) {
    loadMeals().then(() => {
      const stillReading =
        document.body.dataset.tab === 'kuran' && view === 'read' && panel.querySelector('.reader-page')
      if (!stillReading) return
      panel.dataset.read = ''
      renderReader(panel)
    })
  }
  const same = panel.dataset.read === String(sura) && panel.querySelector('.read-list')
  if (!same) {
    const row = surahAt(sura)
    const items = []
    let lastMeal = ''
    for (let n = 1; n <= row.ayahs; n += 1) {
      const meal = meals?.[`${sura}:${n}`] || ''
      const showsMeal = meal && meal !== lastMeal
      if (meal) lastMeal = meal
      items.push(
        `<li><button type="button" class="read-verse" data-ayah="${n}" id="read-${sura}-${n}"><span class="n">${n}</span><span class="verse-body"><span class="tx" lang="ar">${escapeHtml(textAt(sura, n))}</span>${showsMeal ? `<span class="tr">${escapeHtml(meal)}</span>` : ''}</span></button></li>`,
      )
    }
    panel.dataset.read = String(sura)
    panel.innerHTML = `
      <div class="reader-head">
        <button type="button" class="text-btn" id="read-back">${t('quranSurahs')}</button>
        <div class="reader-title">
          <strong lang="ar" dir="rtl">${row.ar}</strong>
          <span>${escapeHtml(surahLabel(sura))} · ${t('quranAyahs', { n: row.ayahs })}</span>
        </div>
        <button type="button" class="play-pill" id="read-toggle">${playing ? t('quranPause') : t('quranPlay')}</button>
      </div>
      <p class="sub read-note" id="read-note">${done ? t('quranDone') : ''}</p>
      <div class="reader-page">
        <ol class="read-list">${items.join('')}</ol>
      </div>`
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
  panel.dataset.playing = playing ? '1' : ''
  panel.querySelectorAll('.read-verse.on').forEach((item) => item.classList.remove('on'))
  const current = document.getElementById(`read-${sura}-${ayah}`)
  if (current) {
    current.classList.add('on')
    current.scrollIntoView({ block: ayah === 1 ? 'nearest' : 'center', behavior: 'smooth' })
  }
}

function renderSearch(panel, query, book) {
  panel.dataset.read = ''
  const folded = foldText(query)
  const named = folded.length >= 2
  const surahs = SURAHS.filter(
    (row) =>
      (named &&
        (foldText(row.tr).includes(folded) ||
          row.en.toLocaleLowerCase('en').includes(folded) ||
          row.ar.includes(query))) ||
      String(row.id) === query,
  )
  const hits = book && named ? verseHits(book, folded) : []
  const shown = hits.slice(0, VERSE_CAP)
  const empty = document.getElementById('empty')
  const waiting = !book
  empty.textContent = t('quranEmpty')
  empty.classList.toggle('hidden', waiting || surahs.length > 0 || hits.length > 0)
  const versesHtml =
    mealsFailed && !waiting
      ? `<p class="sub">${t('quranError')}</p>`
      : waiting
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
