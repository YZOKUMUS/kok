const SUFFIX =
  /^(lerindeki|larındaki|lerinde|larında|lerinden|larından|lerdendi|lardandı|lerden|lardan|lerle|larla|lerin|ların|leri|ları|lere|lara|lidir|lıdır|mişti|mıştı|muştu|müştü|makta|mekte|maktan|mekten|mış|miş|muş|müş|mak|mek|yor|acak|ecek|arak|erek|ınca|ince|unca|ünce|maz|mez|dı|di|du|dü|tı|ti|tu|tü|ıp|ip|up|üp|ken|liği|lığı|luğu|lüğü|lik|lık|luk|lük|ler|lar|den|dan|de|da|nin|nın|nun|nün|dir|dır|dur|dür|tir|tır|in|ın|un|ün|le|la|li|lı|lu|lü|i|ı|u|ü|e|a)/

export function tokenHits(token, query) {
  if (token === query) return true
  if (query.length < 3 || token.length <= query.length || !token.startsWith(query)) return false
  let rest = token.slice(query.length)
  while (rest) {
    const found = SUFFIX.exec(rest)
    if (!found) return false
    rest = rest.slice(found[0].length)
  }
  return true
}

export function wordHits(text, query) {
  const needle = String(query || '').trim().toLocaleLowerCase('tr-TR')
  if (!needle) return false
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .split(/[^a-zçğıöşüâîû]+/)
    .some((token) => tokenHits(token, needle))
}
