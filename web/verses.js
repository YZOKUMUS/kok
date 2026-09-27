const CONTENT = '../content'
let pending = null

export function loadUthmani() {
  if (!pending) {
    pending = fetch(`${CONTENT}/uthmani.json`)
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => {
        pending = null
        return {}
      })
  }
  return pending
}

export function verseText(verses, sura, ayah, fallback) {
  return verses?.[`${sura}:${ayah}`] || fallback || ''
}
