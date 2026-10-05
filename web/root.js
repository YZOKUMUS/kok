import { playVerse, playWord } from './audio.js?v=7'
import { loadGloss, shortMeaning } from './gloss.js?v=2'
import { applyLang, bindLangSwitch, lang, langSwitch, locale, t, tagLabel } from './i18n.js?v=2'
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
  if (!res.ok) throw new Error(t('rootError'))
  return res.json()
}

const rootId = qs('id')
const mount = document.getElementById('root')
const errorEl = document.getElementById('error')

if (!rootId) {
  errorEl.classList.remove('hidden')
  errorEl.textContent = t('rootMissing')
} else {
  try {
    const [root, uthmani] = await Promise.all([loadRoot(rootId), loadUthmani(), loadGloss()])
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
        const form = plain(item.formInAyah)
        const tags = (item.grammar?.raw || [])
          .map((tag) => `<span class="tag">${escapeHtml(tagLabel(tag))}</span>`)
          .join('')
        const meal =
          lang() === 'tr' && item.verseMeaning
            ? `<p class="meaning">${escapeHtml(item.verseMeaning)}</p>`
            : ''
        const verse = item.verseArabic
          ? `<div class="ayah">
              <div class="ar-lg" lang="ar">${highlightVerse(verseText(uthmani, item.sura, item.ayah, item.verseArabic), item.formInAyah)}</div>
              ${item.verseTransliteration ? `<p class="translit">${escapeHtml(item.verseTransliteration)}</p>` : ''}
              <button type="button" class="btn-listen play-verse" data-sura="${item.sura}" data-ayah="${item.ayah}">${t('listenVerse')}</button>
              ${meal}
            </div>`
          : `<p class="stub">${t('noVerseText')}</p>`
        const speech = item.grammar?.partOfSpeech
        const pos = speech === 'Fiil' ? 'fiil' : speech === 'İsim' ? 'isim' : 'diger'
        const meaning = shortMeaning(item.sura, item.ayah, form, item.gloss || '')
        return `
          <article class="verse" data-pos="${pos}">
            <div class="verse-top">
              <span class="ref">${item.sura}:${item.ayah}</span>
            </div>
            <button type="button" class="word play-word" lang="ar" data-sura="${item.sura}" data-ayah="${item.ayah}" data-form="${escapeHtml(form)}">${escapeHtml(form)}</button>
            <p class="reading-line">${escapeHtml(item.transliteration || '')}</p>
            <p class="one-mean">${escapeHtml(meaning)}</p>
            <button type="button" class="btn-listen play-word" data-sura="${item.sura}" data-ayah="${item.ayah}" data-form="${escapeHtml(form)}">${t('listen')}</button>
            ${tags ? `<div class="tags">${tags}</div>` : ''}
            ${verse}
          </article>`
      })
      .join('')

    const studied = isStudied(rootId)
    mount.innerHTML = `
      <header class="study-bar">
        <a class="back" href="./index.html">${t('roots')}</a>
        <div class="name">${escapeHtml(root.latinName || root.id)}</div>
        ${langSwitch()}
        <button type="button" class="check${studied ? ' on' : ''}" id="studied">${studied ? t('studied') : t('mark')}</button>
      </header>
      <div class="sheet">
        <div class="identity">
          <p class="latin">${escapeHtml(root.latinName || root.id)}</p>
          <p class="letters" lang="ar">${escapeHtml(root.lettersArabic || '')}</p>
        </div>
        <a class="btn btn-main wide" href="./lesson.html?root=${encodeURIComponent(root.id)}" style="margin-top:14px">${t('studyRoot')}</a>
        <div class="metrics">
          <div><strong>${root.totalOccurrencesInQuran.toLocaleString(locale())}</strong><span>${t('occurrences')}</span></div>
          <div><strong>${lemmas.length.toLocaleString(locale())}</strong><span>${t('stems')}</span></div>
          <div><strong>${occurrences.length.toLocaleString(locale())}</strong><span>${t('verses')}</span></div>
        </div>
        <section>
          <h2>${t('meaning')}</h2>
          <div class="reading">
            ${meanings.map((item) => `<p>${escapeHtml(item)}</p>`).join('') || `<p>${t('noMeaning')}</p>`}
            ${noteBlocks}
            ${turkish.length ? `<div class="chips" style="margin-top:14px">${turkish.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
          </div>
        </section>
        ${kin ? `<section><h2>${t('kin')}</h2><div class="panel">${kin}</div></section>` : ''}
        <section>
          <div class="section-head">
            <h2>${t('verses')}</h2>
            <div class="seg" id="verse-tabs">
              <button type="button" data-pos="all" class="on">${t('all')}</button>
              <button type="button" data-pos="fiil">${t('verbs')}</button>
              <button type="button" data-pos="isim">${t('nouns')}</button>
            </div>
          </div>
          <p class="sub">${t('verseHelp')}</p>
          ${cards || `<p class="stub">${t('noVerses')}</p>`}
          <p id="no-match" class="stub hidden"></p>
        </section>
        <footer><a href="${escapeHtml(root.sourceUrl || '')}">kuranharitasi.com</a></footer>
      </div>`

    applyLang()
    bindLangSwitch()
    mount.addEventListener('click', async (event) => {
      const verseButton = event.target.closest('.play-verse')
      if (verseButton) {
        const status = verseButton.querySelector('.listen')
        if (status) status.textContent = t('playing')
        try {
          await playVerse(verseButton.dataset.sura, verseButton.dataset.ayah)
          if (status) status.textContent = t('listenVerse')
        } catch {
          if (status) status.textContent = t('noAudio')
        }
        return
      }
      const button = event.target.closest('.play-word')
      if (!button) return
      const status = button.classList.contains('btn-listen') ? button : null
      const previous = status ? status.textContent : ''
      if (status) status.textContent = t('playing')
      try {
        await playWord(button.dataset.sura, button.dataset.ayah, button.dataset.form)
        if (status) status.textContent = t('listen')
      } catch {
        if (status) {
          status.textContent = t('noWordAudio')
          setTimeout(() => {
            status.textContent = previous
          }, 1200)
        }
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
          mode === 'fiil' ? t('noVerbsHere') : mode === 'isim' ? t('noNounsHere') : ''
        empty.classList.toggle('hidden', mode === 'all' || shown > 0)
      }
    })

    document.getElementById('studied')?.addEventListener('click', () => {
      const on = toggleStudied(rootId)
      const button = document.getElementById('studied')
      if (!button) return
      button.textContent = on ? t('studied') : t('mark')
      button.classList.toggle('on', on)
    })
  } catch (err) {
    errorEl.classList.remove('hidden')
    errorEl.textContent = err instanceof Error ? err.message : String(err)
  }
}
