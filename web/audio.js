const AUDIO_BASE = 'https://audio.qurancdn.com/'
const verseCache = new Map()
const chapterCache = new Map()
const VOWELS = 'ًٌٍَُِ'
let player = null
let stopTimer = 0

function fold(value, mode) {
  let text = String(value ?? '')
  text = text.replace(/\u0640/g, '')
  text = text.replace(/ى\u0670/g, 'ا').replace(/و\u0670/g, 'ا')
  text = text.replace(/\u0670/g, 'ا')
  if (mode === 'seat') text = text.replace(/[أإآ]/g, '').replace(/ٱ/g, 'ا')
  else text = text.replace(/[أإآٱ]/g, 'ا')
  if (mode !== 'strict') text = text.replace(/ؤ/g, '').replace(/ئ/g, '').replace(/ء/g, '')
  text = text.replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  text = text.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '')
  text = text.replace(/\s+/g, '')
  text = text.replace(/ا{2,}/g, 'ا')
  if (mode !== 'strict') text = text.replace(/وا$/g, 'و')
  return text
}

function finalVowel(value) {
  const found = [...String(value ?? '')].filter((ch) => VOWELS.includes(ch))
  return found.at(-1) || ''
}

function candidates(words, form, mode) {
  const key = fold(form, mode)
  if (!key) return []
  return words.filter((word) => fold(word.text_uthmani, mode) === key)
}

function chooseWord(words, form) {
  let hits = candidates(words, form, 'strict')
  if (!hits.length) hits = candidates(words, form, 'loose')
  if (!hits.length) {
    const seatHits = candidates(words, form, 'seat')
    if (seatHits.length === 1) hits = seatHits
  }
  const vowel = finalVowel(form)
  if (vowel) {
    const voiced = hits.filter((word) => finalVowel(word.text_uthmani) === vowel)
    if (voiced.length) hits = voiced
  }
  return hits[0] || null
}

function loadVerse(sura, ayah) {
  const key = `${sura}:${ayah}`
  if (!verseCache.has(key)) {
    const url = `https://api.quran.com/api/v4/verses/by_key/${sura}:${ayah}?words=true&word_fields=text_uthmani`
    verseCache.set(
      key,
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error('Ayet sesi alınamadı')
          const data = await res.json()
          return (data.verse?.words || []).filter((word) => word.char_type_name === 'word')
        })
        .catch((err) => {
          verseCache.delete(key)
          throw err
        }),
    )
  }
  return verseCache.get(key)
}

function clipUrl(sura, ayah, position) {
  const part = (value) => String(value).padStart(3, '0')
  return `${AUDIO_BASE}wbw/${part(sura)}_${part(ayah)}_${part(position)}.mp3`
}

function loadChapter(sura) {
  if (!chapterCache.has(sura)) {
    chapterCache.set(
      sura,
      fetch(`https://api.quran.com/api/v4/chapter_recitations/7/${sura}?segments=true`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Ses zamanı alınamadı')
          const data = await res.json()
          const file = data.audio_file
          const byVerse = new Map()
          for (const item of file?.timestamps || []) byVerse.set(item.verse_key, item)
          return { url: file.audio_url, byVerse }
        })
        .catch((err) => {
          chapterCache.delete(sura)
          throw err
        }),
    )
  }
  return chapterCache.get(sura)
}

function wordSpan(timing, position) {
  const hits = (timing?.segments || []).filter((segment) => segment[0] === Number(position))
  if (!hits.length) return null
  return {
    start: Math.min(...hits.map((segment) => segment[1])),
    end: Math.max(...hits.map((segment) => segment[2])),
  }
}

function clearStop() {
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = 0
  }
}

function audioElement() {
  if (!player) player = new Audio()
  return player
}

function start(url) {
  clearStop()
  const audio = audioElement()
  audio.pause()
  audio.src = url
  return audio.play()
}

function playRange(url, startMs, endMs) {
  clearStop()
  const audio = audioElement()
  audio.pause()
  const start = Math.max(0, startMs) / 1000
  const end = Math.max(start + 0.2, endMs / 1000)
  const fromHere = () =>
    new Promise((resolve, reject) => {
      const begin = () => {
        audio.play().then(() => {
          stopTimer = setTimeout(() => {
            audio.pause()
            resolve()
          }, Math.max(200, (end - audio.currentTime) * 1000))
        }, reject)
      }
      if (Math.abs(audio.currentTime - start) < 0.08) {
        begin()
        return
      }
      audio.addEventListener('seeked', begin, { once: true })
      audio.currentTime = start
    })
  if (!audio.src.endsWith(url.slice(url.lastIndexOf('/')))) {
    audio.src = url
    return new Promise((resolve, reject) => {
      audio.addEventListener('loadedmetadata', () => fromHere().then(resolve, reject), { once: true })
      audio.addEventListener('error', () => reject(new Error('Ses açılamadı')), { once: true })
    })
  }
  return fromHere()
}

export function playVerse(sura, ayah) {
  const part = (value) => String(value).padStart(3, '0')
  return start(`${AUDIO_BASE}Sudais/mp3/${part(sura)}${part(ayah)}.mp3`)
}

export async function playWord(sura, ayah, form) {
  const chapterPromise = loadChapter(sura)
  const words = await loadVerse(sura, ayah)
  const hit = chooseWord(words, form)
  if (!hit?.position) throw new Error('Bu kelimenin sesi yok')
  try {
    const chapter = await chapterPromise
    const span = wordSpan(chapter.byVerse.get(`${sura}:${ayah}`), hit.position)
    if (span && chapter.url) {
      await playRange(chapter.url, span.start, span.end)
      return
    }
  } catch {
    // The timed recitation is missing for this verse. The single-word clip is the fallback.
  }
  await start(clipUrl(sura, ayah, hit.position))
}
