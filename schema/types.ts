/**
 * Kur’an Haritası tarzı veri modeli.
 * Kaynak referansı: https://kuranharitasi.com (ayet kelime tablosu + kök sayfaları)
 */

export interface CognateEntry {
  language: string
  form: string
  script?: string
  meaning?: string
}

export interface GrammarTags {
  partOfSpeech?: string
  pattern?: string
  gender?: string
  number?: string
  person?: string
  tense?: string
  case?: string
  voice?: string
  raw?: string[]
}

export interface RootLemma {
  /** Arapça gövde formu, örn. ٱسْم */
  formArabic: string
  /** Kur’an’da bu gövdenin geçiş sayısı */
  count: number
}

export interface RootOccurrence {
  lemmaFormArabic: string
  sura: number
  ayah: number
  /** Ayetteki form */
  formInAyah: string
  transliteration: string
  gloss: string
  grammar?: GrammarTags
  verseArabic?: string
  verseTransliteration?: string
  verseMeaning?: string
}

export interface Root {
  id: string
  /** Latin adı, örn. Sin-Mim-Vav */
  latinName: string
  /** Arapça kök harfler, örn. س م و */
  lettersArabic: string
  /** Kısa anlam özeti satırları */
  meanings: string[]
  /** Açıklayıcı türev notları (semavat, ism…) */
  derivativeNotes?: string[]
  /** Türkçeye girmiş türevler */
  turkishDerivatives?: string[]
  cognates?: CognateEntry[]
  totalOccurrencesInQuran: number
  lemmas: RootLemma[]
  /** Örnek kullanımlar; tam tarama sonrası dolabilir */
  occurrences?: RootOccurrence[]
  sourceUrl?: string
}

export interface VerseWord {
  index: number
  arabic: string
  transliteration: string
  meaningTr: string
  /** Yoksa null (örn. اللَّهِ) */
  rootId: string | null
  rootLettersArabic?: string | null
}

export interface Verse {
  sura: number
  ayah: number
  arabic: string
  meaningTr?: string
  transliteration?: string
  words: VerseWord[]
  sourceUrl?: string
}

export interface KuranHaritasiDataset {
  version: string
  source: string
  notes?: string
  verses: Verse[]
  roots: Root[]
}
