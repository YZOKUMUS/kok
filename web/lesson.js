import { playVerse, playWord } from './audio.js?v=7'
import { shortMeaning } from './gloss.js?v=6'
import { applyLang, lang, t, tagLabel } from './i18n.js?v=10'
import { highlightVerse } from './mark.js?v=5'
import { shareCard } from './share.js?v=6'
import { loadUthmani, verseText } from './verses.js'
import {
  dueWordList,
  gradeWord,
  hasWord,
  isRootFinished,
  markRootFinished,
  remember,
} from './study.js'

const CONTENT = '../content'
const NEW_LIMIT = 8
const REVIEW_LIMIT = 12

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

async function loadIndex() {
  const res = await fetch(`${CONTENT}/index.json`)
  if (!res.ok) throw new Error(t('indexError'))
  return res.json()
}

async function loadRoot(id) {
  const res = await fetch(`${CONTENT}/roots/${encodeURIComponent(rootFile(id))}.json`)
  if (!res.ok) throw new Error(t('rootError'))
  return res.json()
}

function exampleFor(root, lemma) {
  const target = plain(lemma)
  return (
    (root.occurrences || []).find((item) => plain(item.lemmaFormArabic) === target) ||
    (root.occurrences || [])[0] ||
    null
  )
}

function cardsFromRoot(root, mode) {
  const lemmas = [...(root.lemmas || [])].sort((a, b) => b.count - a.count)
  const meaning = (root.meanings || [])[0] || ''
  const due = []
  const fresh = []
  const now = Date.now()
  const dueSet = new Set(dueWordList().filter((word) => word.rootId === root.id).map((word) => word.lemma))
  for (const lemma of lemmas) {
    const form = plain(lemma.formArabic)
    if (!form) continue
    const card = {
      rootId: root.id,
      latin: root.latinName,
      letters: root.lettersArabic,
      meaning,
      lemma: form,
      count: lemma.count,
      example: exampleFor(root, form),
    }
    if (dueSet.has(form)) due.push(card)
    else if (!hasWord(root.id, form)) fresh.push(card)
  }
  if (mode === 'review') return due.slice(0, REVIEW_LIMIT)
  return [...due, ...fresh.slice(0, NEW_LIMIT)]
}

function cardFromVerb(item) {
  return {
    rootId: item.rootId,
    latin: item.latinName,
    letters: item.lettersArabic,
    meaning: item.meaning || '',
    lemma: item.lemma,
    count: item.count,
    example: {
      formInAyah: item.formInAyah,
      transliteration: item.transliteration,
      gloss: item.gloss,
      sura: item.sura,
      ayah: item.ayah,
      verseArabic: item.verseArabic,
      verseMeaning: item.verseMeaning,
      lemmaFormArabic: item.lemma,
    },
  }
}

async function buildListSession(file, key, failMessage) {
  const res = await fetch(`${CONTENT}/${file}`)
  if (!res.ok) throw new Error(failMessage)
  const data = await res.json()
  const forced = qs('root')
  const rows = forced ? data[key].filter((item) => item.rootId === forced) : data[key]
  const dueKeys = new Set(dueWordList().map((word) => `${word.rootId}\t${word.lemma}`))
  const due = []
  const fresh = []
  for (const item of rows) {
    const card = cardFromVerb(item)
    if (dueKeys.has(`${item.rootId}\t${item.lemma}`)) due.push(card)
    else if (!hasWord(item.rootId, item.lemma)) fresh.push(card)
  }
  const review = !forced && due.length > 0
  return {
    root: null,
    cards: review ? due.slice(0, REVIEW_LIMIT) : [...due, ...fresh].slice(0, NEW_LIMIT),
    review,
  }
}

function againHref() {
  if (qs('fiil')) return './lesson.html?fiil=1'
  if (qs('isim')) return './lesson.html?isim=1'
  return './lesson.html'
}

async function buildSession(index) {
  if (qs('fiil')) return buildListSession('verbs.json', 'verbs', t('verbError'))
  if (qs('isim')) return buildListSession('nouns.json', 'nouns', t('nounError'))
  const forced = qs('root')
  if (forced) {
    const root = await loadRoot(forced)
    remember(forced)
    return { root, cards: cardsFromRoot(root, 'mix'), review: false }
  }

  const due = dueWordList()
  if (due.length) {
    const rootId = due[0].rootId
    const root = await loadRoot(rootId)
    return { root, cards: cardsFromRoot(root, 'review'), review: true }
  }

  const ranked = [...index.roots].sort((a, b) => b.totalOccurrencesInQuran - a.totalOccurrencesInQuran)
  for (const entry of ranked) {
    if (isRootFinished(entry.id)) continue
    const root = await loadRoot(entry.id)
    const cards = cardsFromRoot(root, 'new')
    if (cards.length) {
      remember(entry.id)
      return { root, cards, review: false }
    }
    markRootFinished(entry.id)
  }
  return { root: null, cards: [], review: false }
}

const mount = document.getElementById('lesson')
const errorEl = document.getElementById('error')

try {
  const [index, uthmani] = await Promise.all([loadIndex(), loadUthmani()])
  document.body.dataset.kind = qs('fiil') ? 'fiil' : qs('isim') ? 'isim' : 'root'
  document.title = t('lessonTitle')
  const session = await buildSession(index)
  let queue = session.cards
  let cursor = 0
  let known = 0
  let again = 0

  function current() {
    return queue[cursor]
  }

  function paint() {
    const card = current()
    if (!card) {
      const doneRoot = session.root && !session.review
      if (doneRoot && cardsFromRoot(session.root, 'new').length === 0) markRootFinished(session.root.id)
      mount.innerHTML = `
        <div class="lesson">
          <p class="eyebrow">${t('done')}</p>
          <h1>${t('knownCount', { n: known })}</h1>
          <p class="sub">${again ? t('againLeft', { n: again }) : t('allKnown')}</p>
          <div class="actions">
            <a class="btn btn-main wide" href="${againHref()}">${t('nextLesson')}</a>
            <a class="btn wide" href="./index.html">${t('backHome')}</a>
          </div>
        </div>`
      return
    }

    const example = card.example
    const word = plain(example?.formInAyah || card.lemma)
    const meaning = shortMeaning(example?.sura, example?.ayah, word, example?.gloss || '')
    const rootMean = lang() === 'tr' && card.meaning ? `<p class="learn-root-mean">${escapeHtml(card.meaning)}</p>` : ''
    const meal = lang() === 'tr' && example?.verseMeaning ? `<p class="meaning">${escapeHtml(example.verseMeaning)}</p>` : ''
    mount.innerHTML = `
      <div class="lesson">
        <header class="lesson-top">
          <a href="./index.html">${t('close')}</a>
          <span>${cursor + 1} / ${queue.length}</span>
          <a href="./root.html?id=${encodeURIComponent(card.rootId)}">${t('root')}</a>
        </header>
        <p class="lesson-root" lang="ar">${escapeHtml(card.letters || '')}</p>
        <div class="lesson-stage">
          <p class="prompt">${session.review ? t('promptReview') : t('prompt')}</p>
          <button type="button" class="learn-word" id="hear" lang="ar">${escapeHtml(word)}</button>
          <p class="reading-line">${escapeHtml(example?.transliteration || '')}</p>
          <p class="one-mean">${escapeHtml(meaning || '—')}</p>
          <button type="button" class="btn-listen" id="listen">${t('listen')}</button>
          ${rootMean}
          ${
            example?.verseArabic
              ? `<div class="ayah">
                   <span class="ref">${example.sura}:${example.ayah}</span>
                   <button type="button" class="ar-lg" id="verse-text" lang="ar">${highlightVerse(verseText(uthmani, example.sura, example.ayah, example.verseArabic), word)}</button>
                   <button type="button" class="btn-listen" id="play-verse">${t('listenVerse')}</button>
                   ${meal}
                   <button type="button" class="share" id="share">${t('share')}</button>
                 </div>`
              : ''
          }
        </div>
        <div class="actions">
          <button type="button" class="btn" id="again">${t('again')}</button>
          <button type="button" class="btn btn-main" id="know">${t('know')}</button>
        </div>
      </div>`

    applyLang()
    const playTheVerse = async () => {
      const status = document.getElementById('play-verse')
      if (status) status.textContent = t('playing')
      try {
        await playVerse(example?.sura, example?.ayah)
        if (status) status.textContent = t('listenVerse')
      } catch {
        if (status) status.textContent = t('noAudio')
      }
    }
    document.getElementById('verse-text')?.addEventListener('click', playTheVerse)
    document.getElementById('play-verse')?.addEventListener('click', playTheVerse)
    document.getElementById('share')?.addEventListener('click', async () => {
      const shareButton = document.getElementById('share')
      const previous = shareButton.textContent
      shareButton.textContent = t('shareWait')
      try {
        const mode = await shareCard({
          ref: example ? `${example.sura}:${example.ayah}` : '',
          word,
          reading: example?.transliteration || '',
          meaning,
          tags: (example?.grammar?.raw || []).map((tag) => tagLabel(tag)),
          verse: verseText(uthmani, example?.sura, example?.ayah, example?.verseArabic),
          form: word,
          verseReading: example?.verseTransliteration || '',
          meal: lang() === 'tr' ? example?.verseMeaning || '' : '',
          pos: document.body.dataset.kind === 'root' ? '' : document.body.dataset.kind,
        })
        shareButton.textContent = mode === 'copied' ? t('shareCopied') : previous
        if (mode === 'copied') {
          setTimeout(() => {
            shareButton.textContent = previous
          }, 1600)
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          shareButton.textContent = previous
          return
        }
        shareButton.textContent = t('shareFail')
        setTimeout(() => {
          shareButton.textContent = previous
        }, 1400)
      }
    })
    const hear = async (status) => {
      if (status) status.textContent = t('playing')
      try {
        await playWord(example?.sura, example?.ayah, word)
        if (status) status.textContent = t('listen')
      } catch {
        if (status) status.textContent = t('noWordAudio')
      }
    }
    document.getElementById('hear')?.addEventListener('click', () => hear(document.getElementById('listen')))
    document.getElementById('listen')?.addEventListener('click', () => hear(document.getElementById('listen')))
    document.getElementById('again')?.addEventListener('click', () => {
      gradeWord(card.rootId, card.lemma, false)
      again += 1
      queue.push(card)
      cursor += 1
      paint()
    })
    document.getElementById('know')?.addEventListener('click', () => {
      gradeWord(card.rootId, card.lemma, true)
      known += 1
      cursor += 1
      paint()
    })
  }

  paint()
} catch (err) {
  errorEl.classList.remove('hidden')
  errorEl.textContent = err instanceof Error ? err.message : String(err)
}
