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

    const cognateRows = cognates
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.language)}</td>
          <td>${escapeHtml(item.form)}</td>
          <td class="ar" lang="ar">${escapeHtml(item.script || '—')}</td>
          <td>${escapeHtml(item.meaning || '—')}</td>
        </tr>`,
      )
      .join('')

    const lemmaRows = lemmas
      .map((item) => {
        const hot = hottest && item.formArabic === hottest.formArabic && item.count === hottest.count ? ' class="hot"' : ''
        return `<tr${hot}><td class="ar" lang="ar">${escapeHtml(plain(item.formArabic))}</td><td class="num">${item.count.toLocaleString('tr-TR')}</td></tr>`
      })
      .join('')

    const cards = occurrences
      .map((item) => {
        const tags = (item.grammar?.raw || [])
          .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
          .join('')
        const verse = item.verseArabic
          ? `<p class="ar-lg" lang="ar">${escapeHtml(item.verseArabic)}</p>
             ${item.verseTransliteration ? `<p class="translit">${escapeHtml(item.verseTransliteration)}</p>` : ''}
             ${item.verseMeaning ? `<p class="meaning">${escapeHtml(item.verseMeaning)}</p>` : ''}`
          : `<p class="stub">Ayet metni yok.</p>`
        return `
          <article class="occ">
            <div class="occ-head">
              <span class="ar" lang="ar">${escapeHtml(plain(item.lemmaFormArabic))}</span>
              <span class="ref">${item.sura}:${item.ayah}</span>
              <span class="ar" lang="ar">${escapeHtml(plain(item.formInAyah))}</span>
              <span class="translit">${escapeHtml(item.transliteration || '')}</span>
              <span>${escapeHtml(item.gloss || '')}</span>
            </div>
            ${tags ? `<div class="tags">${tags}</div>` : ''}
            ${verse}
          </article>`
      })
      .join('')

    const studied = isStudied(rootId)
    mount.innerHTML = `
      <article class="doc">
        <a class="back" href="./index.html">← Kökler</a>
        <h1>${escapeHtml(root.latinName || root.id)} <span class="letters" lang="ar">${escapeHtml(root.lettersArabic || '')}</span></h1>
        <p class="meta">
          <a href="${escapeHtml(root.sourceUrl || '')}">kuranharitasi.com</a>
          · <button type="button" class="text-btn" id="studied">${studied ? 'Çalışıldı' : 'Çalıştım olarak işaretle'}</button>
        </p>
        <div class="doc-stats">
          <div class="doc-stat"><strong>${root.totalOccurrencesInQuran.toLocaleString('tr-TR')}</strong><span>Kur’an’da geçiş</span></div>
          <div class="doc-stat"><strong>${lemmas.length.toLocaleString('tr-TR')}</strong><span>Gövde türü</span></div>
          <div class="doc-stat"><strong>${occurrences.length.toLocaleString('tr-TR')}</strong><span>Ayet satırı</span></div>
        </div>
        <section>
          <h2>Anlam</h2>
          <div class="block">
            ${meanings.map((item) => `<p>${escapeHtml(item)}</p>`).join('') || '<p>Anlam kaydı yok.</p>'}
            ${notes.length ? `<p class="label">Türev notları</p>${notes.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}` : ''}
            ${turkish.length ? `<p class="label">Türkçeye girmiş türevler</p><p>${escapeHtml(turkish.join(', '))}</p>` : ''}
          </div>
        </section>
        ${
          cognateRows
            ? `<section>
                <h2>Akraba diller</h2>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Dil</th><th>Form</th><th>Yazı</th><th>Anlam</th></tr></thead>
                    <tbody>${cognateRows}</tbody>
                  </table>
                </div>
              </section>`
            : ''
        }
        <section>
          <h2>Gövde(ler)</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Gövde</th><th style="text-align:right">Kur’an’da kez</th></tr></thead>
              <tbody>${lemmaRows || '<tr><td colspan="2">Gövde kaydı yok.</td></tr>'}</tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Kullanımlar</h2>
          ${cards || '<p class="stub">Ayet kaydı yok.</p>'}
        </section>
        <footer>Kaynak: <a href="${escapeHtml(root.sourceUrl || '')}">kuranharitasi.com</a></footer>
      </article>`

    document.getElementById('studied')?.addEventListener('click', () => {
      const on = toggleStudied(rootId)
      const button = document.getElementById('studied')
      if (button) button.textContent = on ? 'Çalışıldı' : 'Çalıştım olarak işaretle'
    })
  } catch (err) {
    errorEl.classList.remove('hidden')
    errorEl.textContent = err instanceof Error ? err.message : String(err)
  }
}
