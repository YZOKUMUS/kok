import { isStudied, remember, saveVerseIndex, toggleStudied, verseIndex } from './study.js'

const CONTENT = '../content'

function qs(name) {
  return new URLSearchParams(location.search).get(name) || ''
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function rootFile(id) {
  return id.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`)
}

async function loadRoot(id) {
  const res = await fetch(`${CONTENT}/roots/${encodeURIComponent(rootFile(id))}.json`)
  if (!res.ok) throw new Error(`Kök yüklenemedi (${res.status})`)
  return res.json()
}

function filteredOccurrences(root, lemma) {
  const occurrences = root.occurrences || []
  if (lemma === 'all') return occurrences
  return occurrences.filter((item) => item.lemmaFormArabic === lemma)
}

const rootId = qs('id')
const mount = document.getElementById('root')
const errorEl = document.getElementById('error')

if (!rootId) {
  errorEl.classList.remove('hidden')
  errorEl.textContent = 'Kök seçilmedi.'
} else {
  try {
    const root = await loadRoot(rootId)
    remember(rootId)
    document.title = `${root.latinName} · Kök çalış`
    let step = 'anlam'
    let lemma = 'all'
    let index = verseIndex(rootId)
    let showGloss = false
    let showReading = false
    let showMeal = false

    function occurrences() {
      return filteredOccurrences(root, lemma)
    }

    function clampIndex() {
      const list = occurrences()
      if (!list.length) {
        index = 0
        return
      }
      if (index >= list.length) index = list.length - 1
      if (index < 0) index = 0
    }

    function renderAnlam() {
      const meaningText = (root.meanings || []).join('\n')
      const notes = (root.derivativeNotes || []).filter((item) => !meaningText.includes(item.replace(/\.$/, '')))
      const cognates = (root.cognates || [])
        .map(
          (item) => `
          <div class="cognate">
            <div>${escapeHtml(item.language)}</div>
            <div>
              <div>${escapeHtml(item.form)}</div>
              ${item.script ? `<div class="ar" lang="ar">${escapeHtml(item.script)}</div>` : ''}
              ${item.meaning ? `<div class="meta">${escapeHtml(item.meaning)}</div>` : ''}
            </div>
          </div>`,
        )
        .join('')
      const studied = isStudied(rootId)
      return `
        <section class="block">
          <h2>Anlam</h2>
          ${(root.meanings || []).map((item) => `<p>${escapeHtml(item)}</p>`).join('') || '<p>Anlam kaydı yok.</p>'}
          ${
            notes.length
              ? `<div class="label">Türev notları</div>${notes.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}`
              : ''
          }
          ${
            root.turkishDerivatives?.length
              ? `<div class="label">Türkçede</div><p>${escapeHtml(root.turkishDerivatives.join(', '))}</p>`
              : ''
          }
          ${cognates ? `<div class="label">Akraba diller</div>${cognates}` : ''}
        </section>
        <button type="button" class="primary${studied ? ' on' : ''}" id="studied">${studied ? 'Çalışıldı · geri al' : 'Bu kökü çalıştım'}</button>`
    }

    function renderGovde() {
      const lemmas = root.lemmas || []
      if (!lemmas.length) return '<section class="block"><p>Gövde kaydı yok.</p></section>'
      return `
        <p class="meta">Bir gövdeye dokun, ayetleri ona göre aç.</p>
        ${lemmas
          .map(
            (item, lemmaIndex) => `
            <button type="button" class="lemma" data-go="${lemmaIndex}">
              <span class="ar" lang="ar" dir="rtl">${escapeHtml(item.formArabic)}</span>
              <b>${item.count.toLocaleString('tr-TR')}</b>
            </button>`,
          )
          .join('')}`
    }

    function renderAyet() {
      clampIndex()
      const list = occurrences()
      if (!list.length) return '<section class="block"><p>Bu kökte ayet yok.</p></section>'
      const item = list[index]
      const tags = (item.grammar?.raw || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
      const lemmas = root.lemmas || []
      const chips =
        lemmas.length > 1
          ? `<div class="chips">
              <button type="button" data-lemma="all" class="${lemma === 'all' ? 'active' : ''}">Tümü</button>
              ${lemmas
                .map(
                  (entry) =>
                    `<button type="button" data-lemma="${escapeHtml(entry.formArabic)}" class="${lemma === entry.formArabic ? 'active' : ''}"><span class="ar" lang="ar" dir="rtl">${escapeHtml(entry.formArabic)}</span></button>`,
                )
                .join('')}
            </div>`
          : ''
      return `
        ${chips}
        <article class="verse-card">
          <div class="ref-row">
            <span class="ref">${item.sura}:${item.ayah}</span>
            <span>${index + 1} / ${list.length.toLocaleString('tr-TR')}</span>
          </div>
          <div class="bar" aria-hidden="true"><span style="width:${((index + 1) / list.length) * 100}%"></span></div>
          <p class="word-line" lang="ar">${escapeHtml(item.formInAyah)}</p>
          <div class="chips tags">${tags}</div>
          <p class="ar-lg" lang="ar">${escapeHtml(item.verseArabic || '')}</p>
          <button type="button" class="reveal${showGloss ? ' open' : ''}" id="show-gloss">${showGloss ? escapeHtml(item.gloss || '—') : 'Kelime anlamını aç'}</button>
          <button type="button" class="reveal${showReading ? ' open' : ''}" id="show-reading">${showReading ? escapeHtml(item.verseTransliteration || item.transliteration || '—') : 'Okunuşu aç'}</button>
          <button type="button" class="reveal${showMeal ? ' open' : ''}" id="show-meal">${showMeal ? escapeHtml(item.verseMeaning || '—') : 'Meali aç'}</button>
          <div class="nav-row">
            <button type="button" id="prev" ${index === 0 ? 'disabled' : ''}>Önceki</button>
            <button type="button" id="next" ${index >= list.length - 1 ? 'disabled' : ''}>Sonraki</button>
          </div>
        </article>`
    }

    function renderStep() {
      if (step === 'govde') return renderGovde()
      if (step === 'ayet') return renderAyet()
      return renderAnlam()
    }

    function paint() {
      mount.innerHTML = `
        <header class="study-head">
          <p class="kicker">${root.totalOccurrencesInQuran.toLocaleString('tr-TR')} geçiş · ${(root.lemmas || []).length} gövde</p>
          <h1>${escapeHtml(root.latinName || root.id)}</h1>
          <p class="big-ar" lang="ar">${escapeHtml(root.lettersArabic || '')}</p>
        </header>
        <div class="stage">${renderStep()}</div>
        <nav class="dock">
          <a href="./index.html">Kökler</a>
          <button type="button" data-step="anlam" class="${step === 'anlam' ? 'active' : ''}">Anlam</button>
          <button type="button" data-step="govde" class="${step === 'govde' ? 'active' : ''}">Gövde</button>
          <button type="button" data-step="ayet" class="${step === 'ayet' ? 'active' : ''}">Ayet</button>
        </nav>`

      mount.querySelectorAll('[data-step]').forEach((button) => {
        button.addEventListener('click', () => {
          step = button.getAttribute('data-step') || 'anlam'
          paint()
        })
      })
      document.getElementById('studied')?.addEventListener('click', () => {
        toggleStudied(rootId)
        paint()
      })
      mount.querySelectorAll('[data-go]').forEach((button) => {
        button.addEventListener('click', () => {
          const lemmaIndex = Number(button.getAttribute('data-go'))
          lemma = root.lemmas[lemmaIndex]?.formArabic || 'all'
          index = 0
          showGloss = false
          showReading = false
          showMeal = false
          step = 'ayet'
          saveVerseIndex(rootId, 0)
          paint()
        })
      })
      mount.querySelectorAll('[data-lemma]').forEach((button) => {
        button.addEventListener('click', () => {
          lemma = button.getAttribute('data-lemma') || 'all'
          index = 0
          showGloss = false
          showReading = false
          showMeal = false
          saveVerseIndex(rootId, 0)
          paint()
        })
      })
      const current = () => occurrences()[index]
      const toggleReveal = (id, flag, opened, closed) => {
        const button = document.getElementById(id)
        if (!button) return
        button.classList.toggle('open', flag)
        button.textContent = flag ? opened : closed
      }
      document.getElementById('show-gloss')?.addEventListener('click', () => {
        showGloss = !showGloss
        toggleReveal('show-gloss', showGloss, current()?.gloss || '—', 'Kelime anlamını aç')
      })
      document.getElementById('show-reading')?.addEventListener('click', () => {
        showReading = !showReading
        const item = current()
        toggleReveal('show-reading', showReading, item?.verseTransliteration || item?.transliteration || '—', 'Okunuşu aç')
      })
      document.getElementById('show-meal')?.addEventListener('click', () => {
        showMeal = !showMeal
        toggleReveal('show-meal', showMeal, current()?.verseMeaning || '—', 'Meali aç')
      })
      document.getElementById('prev')?.addEventListener('click', () => {
        index -= 1
        showGloss = false
        showReading = false
        showMeal = false
        saveVerseIndex(rootId, index)
        paint()
        window.scrollTo(0, 0)
      })
      document.getElementById('next')?.addEventListener('click', () => {
        index += 1
        showGloss = false
        showReading = false
        showMeal = false
        saveVerseIndex(rootId, index)
        paint()
        window.scrollTo(0, 0)
      })
    }

    clampIndex()
    paint()
  } catch (err) {
    errorEl.classList.remove('hidden')
    errorEl.textContent = err instanceof Error ? err.message : String(err)
  }
}
