import { lang } from './i18n.js?v=5'

let book = {}

export function loadGloss() {
  return fetch('../content/gloss-en.json')
    .then(async (res) => {
      book = res.ok ? await res.json() : {}
      return book
    })
    .catch(() => {
      book = {}
      return book
    })
}

export function glossEn(sura, ayah, form) {
  return book[`${sura}:${ayah}\t${form}`] || ''
}

export function shortMeaning(sura, ayah, form, turkish) {
  if (lang() === 'en') {
    const english = glossEn(sura, ayah, form)
    if (english) return english
  }
  return turkish || ''
}
