import { isStudied, remember, toggleStudied } from './study.js'

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

function plain(value) {
  let text = String(value ?? '')
  if (text.includes('>')) text = text.slice(text.lastIndexOf('>') + 1)
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function rootFile(id) {
  return id.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`)
}

async function loadRoot(id) {
  const res = await fetch(`${CONTENT}/roots/${encodeURIComponent(rootFile(id))}.json`)
  if (!res.ok) throw new Error(`Kök yüklenemedi (${res.status})`)
  return res.json()
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
    document.title = `${root.latinName} · ${root.lettersArabic}`

    const notes = root.derivativeNotes || []
    const meanings = (root.meanings || [])
      .map((item) => {
        let text = item
        for (const note of notes) {
          const key = note.replace(/\.$/, '').trim()
          const at = key ? text.indexOf(key) : -1
          if (at > 24) text = text.slice(0, at).trim()
        }
        return text.replace(/[;,.\s]+$/, '')
      })
      .filter(Boolean)
    const turkish = root.turkishDerivatives || []
    const cognates = root.cognates || []
    const lemmas = root.lemmas || []
    const occurrences = root.occurrences || []
    const hottest = lemmas.reduce((best, item) => (item.count > (best?.count || 0) ? item : best), null)

    const maxCount = hottest?.count || 1
    const noteBlocks = notes
      .map((item) => {
        const split = item.match(/^(.+?)\s+[—–-]\s+(.+)$/)
        if (!split) return `<p class="note"><span>${escapeHtml(item)}</span></p>`
        return `<p class="note"><b>${escapeHtml(split[1])}</b><span>${escapeHtml(split[2])}</span></p>`
      })
      .join('')

    const kin = cognates
      .map(
        (item) => `
        <div class="kin">
          <div class="lang">${escapeHtml(item.language)}</div>
          <div>
            <div class="form">${escapeHtml(item.form)}</div>
            ${item.script ? `<div class="script" lang="ar">${escapeHtml(item.script)}</div>` : ''}
          </div>
          ${item.meaning ? `<div class="gloss">${escapeHtml(item.meaning)}</div>` : ''}
        </div>`,
      )
      .join('')

    const lemmaBlocks = lemmas
      .map((item) => {
        const hot = hottest && item.formArabic === hottest.formArabic && item.count === hottest.count ? ' hot' : ''
        const width = Math.max(4, Math.round((item.count / maxCount) * 100))
        return `
          <div class="lemma${hot}">
            <span class="ar" lang="ar">${escapeHtml(plain(item.formArabic))}</span>
            <b>${item.count.toLocaleString('tr-TR')}</b>
            <div class="track" aria-hidden="true"><i style="width:${width}%"></i></div>
          </div>`
      })
      .join('')

    const cards = occurrences
      .map((item) => {
        const tags = (item.grammar?.raw || [])
          .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
          .join('')
        const verse = item.verseArabic
          ? `<div class="ayah">
              <p class="ar-lg" lang="ar">${escapeHtml(item.verseArabic)}</p>
              ${item.verseTransliteration ? `<p class="translit">${escapeHtml(item.verseTransliteration)}</p>` : ''}
              ${item.verseMeaning ? `<p class="meaning">${escapeHtml(item.verseMeaning)}</p>` : ''}
            </div>`
          : `<p class="stub">Ayet metni yok.</p>`
        return `
          <article class="verse">
            <div class="verse-top">
              <span class="ref">${item.sura}:${item.ayah}</span>
              <span class="translit" lang="ar">${escapeHtml(plain(item.lemmaFormArabic))}</span>
            </div>
            <p class="word" lang="ar">${escapeHtml(plain(item.formInAyah))}</p>
            <p class="gloss-line"><span class="translit">${escapeHtml(item.transliteration || '')}</span>${escapeHtml(item.gloss || '')}</p>
            ${tags ? `<div class="tags">${tags}</div>` : ''}
            ${verse}
          </article>`
      })
      .join('')

    const studied = isStudied(rootId)
    mount.innerHTML = `
      <header class="study-bar">
        <a class="back" href="./index.html">Kökler</a>
        <div class="name">${escapeHtml(root.latinName || root.id)}</div>
        <button type="button" class="check${studied ? ' on' : ''}" id="studied">${studied ? 'Çalışıldı' : 'İşaretle'}</button>
      </header>
      <div class="sheet">
        <div class="identity">
          <p class="latin">${escapeHtml(root.latinName || root.id)}</p>
          <p class="letters" lang="ar">${escapeHtml(root.lettersArabic || '')}</p>
        </div>
        <div class="metrics">
          <div><strong>${root.totalOccurrencesInQuran.toLocaleString('tr-TR')}</strong><span>Geçiş</span></div>
          <div><strong>${lemmas.length.toLocaleString('tr-TR')}</strong><span>Gövde</span></div>
          <div><strong>${occurrences.length.toLocaleString('tr-TR')}</strong><span>Ayet</span></div>
        </div>
        <section>
          <h2>Anlam</h2>
          <div class="reading">
            ${meanings.map((item) => `<p>${escapeHtml(item)}</p>`).join('') || '<p>Anlam kaydı yok.</p>'}
            ${noteBlocks}
            ${turkish.length ? `<div class="chips" style="margin-top:14px">${turkish.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
          </div>
        </section>
        ${kin ? `<section><h2>Akraba diller</h2><div class="panel">${kin}</div></section>` : ''}
        <section>
          <h2>Gövdeler</h2>
          <div class="panel">${lemmaBlocks || '<p>Gövde kaydı yok.</p>'}</div>
        </section>
        <section>
          <h2>Ayetler</h2>
          ${cards || '<p class="stub">Ayet kaydı yok.</p>'}
        </section>
        <footer><a href="${escapeHtml(root.sourceUrl || '')}">kuranharitasi.com</a></footer>
      </div>`

    document.getElementById('studied')?.addEventListener('click', () => {
      const on = toggleStudied(rootId)
      const button = document.getElementById('studied')
      if (!button) return
      button.textContent = on ? 'Çalışıldı' : 'İşaretle'
      button.classList.toggle('on', on)
    })
  } catch (err) {
    errorEl.classList.remove('hidden')
    errorEl.textContent = err instanceof Error ? err.message : String(err)
  }
}
