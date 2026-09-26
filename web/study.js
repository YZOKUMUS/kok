const KEY = 'kh-m33-study'

function empty() {
  return { studied: {}, lastId: '', verseAt: {}, words: {}, finished: {} }
}

export function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      studied: raw.studied && typeof raw.studied === 'object' ? raw.studied : {},
      lastId: typeof raw.lastId === 'string' ? raw.lastId : '',
      verseAt: raw.verseAt && typeof raw.verseAt === 'object' ? raw.verseAt : {},
      words: raw.words && typeof raw.words === 'object' ? raw.words : {},
      finished: raw.finished && typeof raw.finished === 'object' ? raw.finished : {},
    }
  } catch {
    return empty()
  }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function isStudied(id) {
  return Boolean(readState().studied[id])
}

export function studiedCount() {
  return Object.keys(readState().studied).length
}

export function toggleStudied(id) {
  const state = readState()
  if (state.studied[id]) delete state.studied[id]
  else state.studied[id] = Date.now()
  write(state)
  return Boolean(state.studied[id])
}

export function remember(id) {
  const state = readState()
  state.lastId = id
  write(state)
}

export function verseIndex(id) {
  const value = readState().verseAt[id]
  return Number.isInteger(value) && value >= 0 ? value : 0
}

export function saveVerseIndex(id, index) {
  const state = readState()
  state.verseAt[id] = index
  state.lastId = id
  write(state)
}

const DAY = 24 * 60 * 60 * 1000
const GAPS = [0, DAY, 3 * DAY, 7 * DAY, 21 * DAY]

function wordKey(rootId, lemma) {
  return `${rootId}\t${lemma}`
}

export function knownWordCount() {
  return Object.values(readState().words).filter((word) => word.box >= 1).length
}

export function dueWordCount() {
  const now = Date.now()
  return Object.values(readState().words).filter((word) => word.due <= now).length
}

export function isRootFinished(id) {
  return Boolean(readState().finished[id])
}

export function markRootFinished(id) {
  const state = readState()
  state.finished[id] = Date.now()
  write(state)
}

export function dueWordList() {
  const now = Date.now()
  return Object.values(readState().words).filter((word) => word.due <= now && word.rootId && word.lemma)
}

export function gradeWord(rootId, lemma, knew) {
  const state = readState()
  const key = wordKey(rootId, lemma)
  const prev = state.words[key] || { box: 0 }
  const box = knew ? Math.min((prev.box || 0) + 1, 4) : 0
  state.words[key] = {
    box,
    due: Date.now() + (knew ? GAPS[box] : 0),
    rootId,
    lemma,
  }
  write(state)
}

export function hasWord(rootId, lemma) {
  return Boolean(readState().words[wordKey(rootId, lemma)])
}
