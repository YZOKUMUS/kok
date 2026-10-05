const KEY = 'kh-lang'

const PACK = {
  tr: {
    brand: 'Kök',
    lessonTitle: 'Ders',
    homeTitle: 'Kök çalış',
    searchLabel: 'Kök ara',
    searchPlaceholder: 'Anlam, harf veya ad',
    dict: 'Sözlük',
    verbs: 'Fiiller',
    nouns: 'İsimler',
    all: 'Tümü',
    count: '{words} kelime öğrenildi · {roots} kök',
    emptyRoots: 'Bu aramada kök yok.',
    emptyVerbs: 'Bu aramada fiil yok.',
    emptyNouns: 'Bu aramada isim yok.',
    verbEyebrow: 'Fiil dersi',
    verbTitle: 'Yalnızca fiilleri çalış',
    verbBlurb: 'fiil. İsimler bu listede yok.',
    nounEyebrow: 'İsim dersi',
    nounTitle: 'Yalnızca isimleri çalış',
    nounBlurb: 'isim. Yalnızca isim olan kelimeler.',
    lessonEyebrow: 'Ders',
    lessonDue: 'Tekrar zamanı',
    lessonStudy: 'Kelime çalış',
    lessonDueBlurb: '{n} kelime seni bekliyor',
    lessonStudyBlurb: 'Önce kelime, sonra anlam. Günde bir avuç.',
    continueEyebrow: 'Sözlük',
    continueBlurb: 'Kökün anlamı ve ayetleri',
    progress: 'İlerleme',
    letters: 'Harften başla',
    backLetters: 'Harfler',
    letterCount: '{n} kök',
    roots: 'Kökler',
    studied: 'Çalışıldı',
    mark: 'İşaretle',
    studyRoot: 'Bu kökün kelimelerini çalış',
    occurrences: 'Geçiş',
    stems: 'Gövde',
    verses: 'Ayet',
    meaning: 'Anlam',
    noMeaning: 'Anlam kaydı yok.',
    kin: 'Akraba diller',
    verseHelp: 'Kelimeye dokununca kelime çalar. Ayete dokununca ayet çalar.',
    noVerses: 'Ayet kaydı yok.',
    noVerseText: 'Ayet metni yok.',
    noVerbsHere: 'Bu kökte fiil yok.',
    noNounsHere: 'Bu kökte isim yok.',
    share: 'Paylaş',
    shareWait: 'Hazırlanıyor',
    shareCopied: 'Kopyalandı',
    shareHint: 'Resme sağ tıkla ve kopyala. Yapıştırman yeterli.',
    shareFail: 'Paylaşılamadı',
    listen: 'Dinle',
    listenVerse: 'Ayeti dinle',
    playing: 'Çalıyor',
    noAudio: 'Ses yok',
    noWordAudio: 'Ses bulunamadı',
    close: 'Kapat',
    root: 'Kök',
    prompt: 'Bu kelime',
    promptReview: 'Tekrar',
    again: 'Tekrar',
    know: 'Biliyorum',
    done: 'Ders bitti',
    knownCount: '{n} kelimeyi bildin',
    againLeft: '{n} kelime yarına kaldı.',
    allKnown: 'Bu turda hepsini bildin.',
    nextLesson: 'Sonraki ders',
    backHome: 'Sözlüğe dön',
    indexError: 'İndeks yüklenemedi',
    verbError: 'Fiil listesi yüklenemedi',
    nounError: 'İsim listesi yüklenemedi',
    rootError: 'Kök yüklenemedi',
    rootMissing: 'Kök seçilmedi.',
    ok: 'ok',
  },
  en: {
    brand: 'Root',
    lessonTitle: 'Lesson',
    homeTitle: 'Study the roots',
    searchLabel: 'Search roots',
    searchPlaceholder: 'Meaning, letter, or name',
    dict: 'Dictionary',
    verbs: 'Verbs',
    nouns: 'Nouns',
    all: 'All',
    count: '{words} words learned · {roots} roots',
    emptyRoots: 'No root matches this search.',
    emptyVerbs: 'No verb matches this search.',
    emptyNouns: 'No noun matches this search.',
    verbEyebrow: 'Verb lesson',
    verbTitle: 'Study only the verbs',
    verbBlurb: 'verbs. Nouns are not in this list.',
    nounEyebrow: 'Noun lesson',
    nounTitle: 'Study only the nouns',
    nounBlurb: 'nouns. Only words that are nouns.',
    lessonEyebrow: 'Lesson',
    lessonDue: 'Time to review',
    lessonStudy: 'Study a word',
    lessonDueBlurb: '{n} words are ready',
    lessonStudyBlurb: 'Hear the word, then the meaning.',
    continueEyebrow: 'Dictionary',
    continueBlurb: 'The root, its meaning, and its verses',
    progress: 'Progress',
    letters: 'Start from a letter',
    backLetters: 'Letters',
    letterCount: '{n} roots',
    roots: 'Roots',
    studied: 'Studied',
    mark: 'Mark',
    studyRoot: 'Study the words of this root',
    occurrences: 'Uses',
    stems: 'Stems',
    verses: 'Verses',
    meaning: 'Meaning',
    noMeaning: 'No meaning on file.',
    kin: 'Related languages',
    verseHelp: 'Tap the word to hear it. Tap the verse to hear the verse.',
    noVerses: 'No verse on file.',
    noVerseText: 'No verse text.',
    noVerbsHere: 'This root has no verb.',
    noNounsHere: 'This root has no noun.',
    share: 'Share',
    shareWait: 'Preparing',
    shareCopied: 'Copied',
    shareHint: 'Right-click the picture and copy it. Then paste.',
    shareFail: 'Could not share',
    listen: 'Listen',
    listenVerse: 'Listen to the verse',
    playing: 'Playing',
    noAudio: 'No audio',
    noWordAudio: 'No word audio',
    close: 'Close',
    root: 'Root',
    prompt: 'This word',
    promptReview: 'Review',
    again: 'Again',
    know: 'I know it',
    done: 'Lesson done',
    knownCount: 'You knew {n} words',
    againLeft: '{n} words wait until tomorrow.',
    allKnown: 'You knew every word this round.',
    nextLesson: 'Next lesson',
    backHome: 'Back to the dictionary',
    indexError: 'The index could not be loaded',
    verbError: 'The verb list could not be loaded',
    nounError: 'The noun list could not be loaded',
    rootError: 'The root could not be loaded',
    rootMissing: 'No root was selected.',
    ok: 'ok',
  },
}

const TAGS = {
  Fiil: 'Verb',
  İsim: 'Noun',
  Sıfat: 'Adjective',
  Edilgen: 'Passive',
  Etken: 'Active',
  Eril: 'Masculine',
  Dişil: 'Feminine',
  Tekil: 'Singular',
  Çoğul: 'Plural',
  İkil: 'Dual',
  'Mecrûr İsim': 'Genitive',
  'Merfû İsim': 'Nominative',
  'Mansûb İsim': 'Accusative',
  'Mecrûr': 'Genitive',
  'Merfû': 'Nominative',
  'Mansûb': 'Accusative',
}

export function lang() {
  return localStorage.getItem(KEY) === 'en' ? 'en' : 'tr'
}

export function setLang(next) {
  localStorage.setItem(KEY, next === 'en' ? 'en' : 'tr')
}

export function t(key, vars) {
  let text = PACK[lang()][key] || PACK.tr[key] || key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

export function tagLabel(value) {
  if (lang() !== 'en') return value
  return TAGS[value] || value
}

export function locale() {
  return lang() === 'en' ? 'en-US' : 'tr-TR'
}

export function applyLang() {
  document.documentElement.lang = lang() === 'en' ? 'en' : 'tr'
  document.querySelectorAll('[data-set-lang]').forEach((button) => {
    button.classList.toggle('on', button.getAttribute('data-set-lang') === lang())
  })
}

export function bindLangSwitch() {
  document.querySelectorAll('[data-set-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      setLang(button.getAttribute('data-set-lang'))
      location.reload()
    })
  })
}

const FLAG_TR = `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#e30a17"/><circle cx="12" cy="10" r="5" fill="#fff"/><circle cx="13.4" cy="10" r="4" fill="#e30a17"/><path fill="#fff" d="M19.2 10 17.9 10.9l.5-1.5-1.3-.9h1.6L19.2 7l.5 1.5h1.6l-1.3.9z"/></svg>`
const FLAG_EN = `<svg viewBox="0 0 60 30" aria-hidden="true"><defs><clipPath id="en-flag"><rect width="60" height="30"/></clipPath></defs><g clip-path="url(#en-flag)"><rect width="60" height="30" fill="#012169"/><path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="8"/><path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="12"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="7"/></g></svg>`

export function langSwitch() {
  const trOn = lang() === 'tr' ? ' on' : ''
  const enOn = lang() === 'en' ? ' on' : ''
  return `<div class="lang-switch" id="lang-switch">
    <button type="button" data-set-lang="tr" class="${trOn.trim()}" aria-label="Türkçe">${FLAG_TR}</button>
    <button type="button" data-set-lang="en" class="${enOn.trim()}" aria-label="English">${FLAG_EN}</button>
  </div>`
}
