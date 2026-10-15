import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const OWNER = 'ziya.okumus@gmail.com'
const TAG_KEY = 'kh-visit-tag'
const LOGGED_KEY = 'kh-visit-logged'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const app = initializeApp({
  apiKey: 'AIzaSyClfyzzzkHdNFrKPuxzv_v8CBtOujWTU8k',
  authDomain: 'kok-calis.firebaseapp.com',
  projectId: 'kok-calis',
  appId: '1:201243999042:web:5dae21e57d830eb29826db',
})

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function deviceKind() {
  const phone = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 520
  return phone ? 'phone' : 'computer'
}

function visitMark() {
  const existing = localStorage.getItem(TAG_KEY)
  if (existing && /^[A-HJ-NP-Z2-9]{4}$/.test(existing)) return { tag: existing, kind: 'back' }
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const tag = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
  localStorage.setItem(TAG_KEY, tag)
  return { tag, kind: 'new' }
}

async function noteVisit(db) {
  if (sessionStorage.getItem(LOGGED_KEY)) return
  const { tag, kind } = visitMark()
  try {
    await addDoc(collection(db, 'visits'), {
      at: serverTimestamp(),
      kind,
      device: deviceKind(),
      tag,
    })
    sessionStorage.setItem(LOGGED_KEY, '1')
  } catch {
    /* Giriş yazılamazsa uygulama açılmaya devam eder. */
  }
}

function closeSheet() {
  document.getElementById('visits-sheet')?.remove()
}

function openSheet(html) {
  closeSheet()
  const wrap = document.createElement('div')
  wrap.id = 'visits-sheet'
  wrap.innerHTML = html
  wrap.addEventListener('click', (event) => {
    if (event.target === wrap) wrap.remove()
  })
  document.body.appendChild(wrap)
  return wrap
}

function whenLabel(date) {
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sameDay(left, right) {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return format.format(left) === format.format(right)
}

async function openList(auth, db) {
  const wrap = openSheet('<div class="share-sheet visits-sheet"><p>Yükleniyor…</p></div>')
  const sheet = wrap.querySelector('.visits-sheet')
  try {
    const snap = await getDocs(query(collection(db, 'visits'), orderBy('at', 'desc'), limit(80)))
    const rows = snap.docs.map((item) => item.data()).filter((row) => row.at?.toDate)
    const today = rows.filter((row) => sameDay(row.at.toDate(), new Date())).length
    const lines = rows.map((row) => {
      const where = row.device === 'phone' ? 'telefon' : 'bilgisayar'
      const again = row.kind === 'back' ? 'yine' : 'yeni'
      return `<li><b>${escapeHtml(row.tag)}</b> · ${where} · ${again}<span>${escapeHtml(whenLabel(row.at.toDate()))}</span></li>`
    }).join('')
    sheet.innerHTML = `
      <h2>Girenler</h2>
      <p>Bugün ${today} giriş. İsim yok; aynı işaret aynı cihaz.</p>
      ${lines ? `<ul class="visit-list">${lines}</ul>` : '<p>Henüz giriş yok.</p>'}
      <button type="button" class="share-close" id="visits-close">Kapat</button>
      <button type="button" class="text-btn visits-out" id="visits-out">Bu cihazdan çık</button>`
  } catch (err) {
    if (err?.code === 'permission-denied') signOut(auth).catch(() => {})
    sheet.innerHTML = `
      <h2>Girenler</h2>
      <p>Liste açılamadı.</p>
      <button type="button" class="share-close" id="visits-close">Kapat</button>`
  }
  sheet.querySelector('#visits-close')?.addEventListener('click', closeSheet)
  sheet.querySelector('#visits-out')?.addEventListener('click', async () => {
    await signOut(auth)
    closeSheet()
  })
}

function openLogin(auth, db) {
  const wrap = openSheet(`
    <form class="share-sheet visits-sheet" id="visits-form">
      <h2>Girenler</h2>
      <label>Şifre<input type="password" name="password" autocomplete="current-password" required /></label>
      <p class="visits-error" hidden></p>
      <button type="submit" class="share-close">Aç</button>
      <button type="button" class="text-btn visits-out" id="visits-cancel">Vazgeç</button>
    </form>`)
  wrap.querySelector('#visits-cancel')?.addEventListener('click', closeSheet)
  wrap.querySelector('#visits-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const error = form.querySelector('.visits-error')
    error.hidden = true
    try {
      await signInWithEmailAndPassword(auth, OWNER, form.password.value)
      closeSheet()
      openList(auth, db)
    } catch {
      error.hidden = false
      error.textContent = 'Şifre olmadı.'
    }
  })
  wrap.querySelector('input')?.focus()
}

function bindOpen(auth, db) {
  const brand = document.getElementById('brand')
  if (!brand) return
  brand.addEventListener('click', () => {
    if (isOwner(getAuth(app).currentUser)) openList(auth, db)
    else openLogin(auth, db)
  })
}

function isOwner(user) {
  return user?.email === OWNER
}

export function watchVisits() {
  const auth = getAuth(app)
  const db = getFirestore(app)
  noteVisit(db)
  onAuthStateChanged(auth, (user) => {
    if (user && !isOwner(user)) signOut(auth).catch(() => {})
  })
  bindOpen(auth, db)
}
