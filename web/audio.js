const AUDIO_BASE = 'https://audio.qurancdn.com/'
const VERSE_RECITER = 7
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

function pad3(value) {
  return String(value).padStart(3, '0')
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

function loadChapter(sura) {
  if (!chapterCache.has(sura)) {
    chapterCache.set(
      sura,
      fetch(`https://api.quran.com/api/v4/chapter_recitations/${VERSE_RECITER}/${sura}?segments=true`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Ayet sesi alınamadı')
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
      if (Math.abs(audio.currentTime - start) < 0.05) {
        begin()
        return
      }
      audio.addEventListener('seeked', begin, { once: true })
      audio.currentTime = start
    })
  if (audio.src !== url) {
    audio.src = url
    if (audio.readyState >= 1) return fromHere()
    return new Promise((resolve, reject) => {
      audio.addEventListener('loadedmetadata', () => fromHere().then(resolve, reject), { once: true })
      audio.addEventListener('error', () => reject(new Error('Ayet sesi açılamadı')), { once: true })
    })
  }
  return fromHere()
}

export async function playVerse(sura, ayah) {
  const chapter = await loadChapter(sura)
  const timing = chapter.byVerse.get(`${sura}:${ayah}`)
  if (!timing || !chapter.url) throw new Error('Ayet sesi yok')
  await playRange(chapter.url, timing.timestamp_from, timing.timestamp_to)
}

export async function playWord(sura, ayah, form) {
  const words = await loadVerse(sura, ayah)
  const hit = chooseWord(words, form)
  if (!hit?.position) throw new Error('Bu kelimenin sesi yok')
  await start(`${AUDIO_BASE}wbw/${pad3(sura)}_${pad3(ayah)}_${pad3(hit.position)}.mp3`)
}
