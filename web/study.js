const KEY = 'kh-m33-study'

function empty() {
  return { studied: {}, lastId: '', verseAt: {} }
}

export function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      studied: raw.studied && typeof raw.studied === 'object' ? raw.studied : {},
      lastId: typeof raw.lastId === 'string' ? raw.lastId : '',
      verseAt: raw.verseAt && typeof raw.verseAt === 'object' ? raw.verseAt : {},
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
