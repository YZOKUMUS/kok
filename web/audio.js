const AUDIO_BASE = 'https://audio.qurancdn.com/'
const verseCache = new Map()
let player = null

function normArabic(value) {
  let text = String(value ?? '')
  text = text.replace(/\u0640/g, '').replace(/\u0670/g, 'ا')
  text = text.replace(/[أإآٱ]/g, 'ا')
  text = text.replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ء/g, '')
  text = text.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '')
  text = text.replace(/\s+/g, '')
  text = text.replace(/ا{2,}/g, 'ا')
  return text
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

export async function playWord(sura, ayah, form) {
  const words = await loadVerse(sura, ayah)
  const target = normArabic(form)
  const hit = words.find((word) => normArabic(word.text_uthmani) === target)
  if (!hit?.audio_url) throw new Error('Bu kelimenin sesi yok')
  if (!player) player = new Audio()
  player.pause()
  player.src = `${AUDIO_BASE}${hit.audio_url}`
  await player.play()
}
