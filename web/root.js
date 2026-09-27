import { playVerse, playWord } from './audio.js'
import { highlightVerse } from './mark.js?v=4'
import { isStudied, remember, toggleStudied } from './study.js'
import { loadUthmani, verseText } from './verses.js'

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
    const [root, uthmani] = await Promise.all([loadRoot(rootId), loadUthmani()])
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

    const cards = occurrences
      .map((item) => {
        const tags = (item.grammar?.raw || [])
          .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
          .join('')
        const verse = item.verseArabic
          ? `<div class="ayah">
              <button type="button" class="play-verse" data-sura="${item.sura}" data-ayah="${item.ayah}">
                <span class="ar-lg" lang="ar">${highlightVerse(verseText(uthmani, item.sura, item.ayah, item.verseArabic), item.formInAyah)}</span>
                ${item.verseTransliteration ? `<span class="translit">${escapeHtml(item.verseTransliteration)}</span>` : ''}
                <span class="listen">Ayeti dinle</span>
              </button>
              ${item.verseMeaning ? `<p class="meaning">${escapeHtml(item.verseMeaning)}</p>` : ''}
            </div>`
          : `<p class="stub">Ayet metni yok.</p>`
        const speech = item.grammar?.partOfSpeech
        const pos = speech === 'Fiil' ? 'fiil' : speech === 'İsim' ? 'isim' : 'diger'
        return `
          <article class="verse" data-pos="${pos}">
            <div class="verse-top">
              <span class="ref">${item.sura}:${item.ayah}</span>
              <span class="translit" lang="ar">${escapeHtml(plain(item.lemmaFormArabic))}</span>
            </div>
            <button type="button" class="word play-word" lang="ar" data-sura="${item.sura}" data-ayah="${item.ayah}" data-form="${escapeHtml(plain(item.formInAyah))}">${escapeHtml(plain(item.formInAyah))}</button>
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
        <a class="btn btn-main wide" href="./lesson.html?root=${encodeURIComponent(root.id)}" style="margin-top:14px">Bu kökün kelimelerini çalış</a>
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
          <div class="section-head">
            <h2>Ayetler</h2>
            <div class="seg" id="verse-tabs">
              <button type="button" data-pos="all" class="on">Tümü</button>
              <button type="button" data-pos="fiil">Fiiller</button>
              <button type="button" data-pos="isim">İsimler</button>
            </div>
          </div>
          <p class="sub">Kelimeye dokununca kelime, okunuş satırına dokununca ayet çalar.</p>
          ${cards || '<p class="stub">Ayet kaydı yok.</p>'}
          <p id="no-match" class="stub hidden"></p>
        </section>
        <footer><a href="${escapeHtml(root.sourceUrl || '')}">kuranharitasi.com</a></footer>
      </div>`

    mount.addEventListener('click', async (event) => {
      const verseButton = event.target.closest('.play-verse')
      if (verseButton) {
        const status = verseButton.querySelector('.listen')
        if (status) status.textContent = 'Çalıyor'
        try {
          await playVerse(verseButton.dataset.sura, verseButton.dataset.ayah)
          if (status) status.textContent = 'Ayeti dinle'
        } catch {
          if (status) status.textContent = 'Ses yok'
        }
        return
      }
      const button = event.target.closest('.play-word')
      if (!button) return
      const previous = button.textContent
      try {
        await playWord(button.dataset.sura, button.dataset.ayah, button.dataset.form)
      } catch {
        button.textContent = 'Ses yok'
        setTimeout(() => {
          button.textContent = previous
        }, 1200)
      }
    })

    document.getElementById('verse-tabs')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-pos]')
      if (!button) return
      const mode = button.getAttribute('data-pos')
      document.querySelectorAll('#verse-tabs button').forEach((item) => {
        item.classList.toggle('on', item === button)
      })
      let shown = 0
      mount.querySelectorAll('.verse').forEach((article) => {
        const keep = mode === 'all' || article.getAttribute('data-pos') === mode
        article.classList.toggle('hidden', !keep)
        if (keep) shown += 1
      })
      const empty = document.getElementById('no-match')
      if (empty) {
        empty.textContent =
          mode === 'fiil' ? 'Bu kökte fiil yok.' : mode === 'isim' ? 'Bu kökte isim yok.' : ''
        empty.classList.toggle('hidden', mode === 'all' || shown > 0)
      }
    })

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
