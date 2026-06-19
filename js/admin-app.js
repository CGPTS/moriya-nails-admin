// ============================================================
// Admin Panel — Enterprise Edition v2.0
// מערכת ניהול Moriya Nails
// ============================================================
'use strict';

// ── CONSTANTS ──────────────────────────────────────────────
const ADMIN_CONFIG = Object.freeze({
  NOTIF_DAYS_START:  14,
  NOTIF_DAYS_END:    21,
});

const SERVICE_CATALOG = Object.freeze([
  { id: 'gel-structure',  name: "לק ג'ל מבנה אנטומי", price: 100, duration: 90 },
  { id: 'gel-regular',    name: "לק ג'ל רגיל",          price: 90,  duration: 75 },
  { id: 'manicure-hands', name: 'מניקור ידיים',          price: 60,  duration: 45 },
  { id: 'gel-removal',    name: "הסרת לק ג'ל",           price: 30,  duration: 20 },
  { id: 'nail-repair',    name: 'השלמת ציפורן',          price: 10,  duration: 10 },
  { id: 'gel-feet',       name: "לק ג'ל ברגליים",        price: 80,  duration: 50 },
]);

const SERVICE_BY_ID = Object.freeze(Object.fromEntries(SERVICE_CATALOG.map(service => [service.id, service])));
const SERVICE_PRICES = Object.freeze(Object.fromEntries(SERVICE_CATALOG.map(service => [service.name, service.price])));
const SERVICE_LABEL_ALIASES = Object.freeze({
  "לק גל מבנה אנטומי": 'gel-structure',
  "לק ג'ל מבנה אנטומי": 'gel-structure',
  "לק גל רגיל": 'gel-regular',
  "לק ג'ל רגיל": 'gel-regular',
  'מניקור בידיים': 'manicure-hands',
  'מניקור ידיים': 'manicure-hands',
  "הסרת לק גל": 'gel-removal',
  "הסרת לק ג'ל": 'gel-removal',
  'השלמת ציפורן': 'nail-repair',
  "לק גל ברגליים": 'gel-feet',
  "לק ג'ל ברגליים": 'gel-feet',
});

const PROJECTOR_PRICE = 0;
const MANUAL_RECEIPT_MAX_MB = 10;
const MANUAL_RECEIPT_COMPRESS_TARGET_KB = 120;
const MANUAL_RECEIPT_MAX_WIDTH = 900;
const MANUAL_RECEIPT_ALLOWED_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const SLOT_STEP_MINUTES = 15;
const LOCK_STEP_MINUTES = 5;
const WORKING_HOURS = Object.freeze({
  0: { start: 8 * 60, end: 15 * 60, label: '08:00-15:00' },
  1: { start: 8 * 60, end: 15 * 60, label: '08:00-15:00' },
  2: { start: 8 * 60, end: 15 * 60, label: '08:00-15:00' },
  3: { start: 8 * 60, end: 15 * 60, label: '08:00-15:00' },
  4: { start: 8 * 60, end: 15 * 60, label: '08:00-15:00' },
  5: { start: 8 * 60, end: 12 * 60, label: '08:00-12:00' },
});
const LEGACY_SLOT_STARTS = Object.freeze(['10-00', '11-00', '12-00', '13-00', '14-00', '15-00', '16-00']);

const SLOT_META = Object.freeze((() => {
  const meta = {};
  for (let minutes = 8 * 60; minutes <= 16 * 60; minutes += SLOT_STEP_MINUTES) {
    const slot = minutesToSlot(minutes);
    meta[slot] = buildSlotMeta(minutes, SLOT_STEP_MINUTES);
  }
  return meta;
})());
const SLOT_KEYS = Object.freeze(Object.keys(SLOT_META));

const MONTH_NAMES = Object.freeze([
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
]);

const DAY_NAMES = Object.freeze(['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']);

const STATUS_LABELS = Object.freeze({
  approved:  'פעיל',
  completed: 'הסתיים',
  cancelled: 'מבוטל',
});

const EVENT_TYPES = Object.freeze([
  ...SERVICE_CATALOG.map(service => service.name),
]);

/**
 * Canonicalize event-type labels for compatibility with backend rules.
 * Supports old typo "תור קהלתי" from legacy records/forms.
 * @param {string} eventType
 * @returns {string}
 */
function normalizeEventType(eventType) {
  const id = serviceIdFromValue(eventType);
  return id ? SERVICE_BY_ID[id].name : (eventType || '').trim();
}

function normalizeServiceLabel(label) {
  return String(label || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/׳/g, "'")
    .replace(/גל/g, "ג'ל")
    .replace(/מניקור בידיים/g, 'מניקור ידיים');
}

function serviceIdFromValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (SERVICE_BY_ID[raw]) return raw;
  const normalized = normalizeServiceLabel(raw);
  return SERVICE_LABEL_ALIASES[normalized]
    || SERVICE_CATALOG.find(service => normalizeServiceLabel(service.name) === normalized)?.id
    || '';
}

function uniqueServiceIds(ids) {
  return [...new Set((ids || []).map(serviceIdFromValue).filter(Boolean))];
}

function serviceIdsFromEventType(eventType) {
  if (Array.isArray(eventType)) return uniqueServiceIds(eventType);
  return uniqueServiceIds(String(eventType || '').split(/\s*(?:,|\+|،)\s*/));
}

function serviceNamesFromIds(ids) {
  return uniqueServiceIds(ids).map(id => SERVICE_BY_ID[id]?.name).filter(Boolean);
}

function servicesFromIds(ids) {
  return uniqueServiceIds(ids).map(id => SERVICE_BY_ID[id]).filter(Boolean);
}

function serviceSnapshotFromIds(ids) {
  return servicesFromIds(ids).map(({ id, name, price, duration }) => ({ id, name, price, duration }));
}

function serviceTotals(ids) {
  return servicesFromIds(ids).reduce((total, service) => ({
    price: total.price + service.price,
    duration: total.duration + service.duration,
  }), { price: 0, duration: 0 });
}

function formatDuration(minutes) {
  if (!minutes) return '0 דקות';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} דקות`;
  if (!mins) return hours === 1 ? 'שעה' : `${hours} שעות`;
  return `${hours} שעות ו-${mins} דקות`;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutesToSlot(minutes) {
  return minutesToTime(minutes).replace(':', '-');
}

function slotToMinutes(slot) {
  const match = String(slot || '').match(/^(\d{1,2})-(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function buildSlotMeta(startMinutes, durationMinutes = SLOT_STEP_MINUTES) {
  const endMinutes = startMinutes + durationMinutes;
  return {
    text: minutesToTime(startMinutes),
    hours: `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`,
    startMinutes,
    endMinutes,
  };
}

function workingHoursForDow(dow) {
  return WORKING_HOURS[dow] || null;
}

function isBookableDow(dow) {
  return !!workingHoursForDow(dow);
}

function lockSlotsForRange(startMinutes, endMinutes) {
  const slots = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += LOCK_STEP_MINUTES) {
    slots.push(minutesToSlot(minutes));
  }
  return slots;
}

function lockProbeSlotsForRange(startMinutes, endMinutes) {
  const legacy = LEGACY_SLOT_STARTS.filter(slot => {
    const start = slotToMinutes(slot);
    return start !== null && start < endMinutes && start + 60 > startMinutes;
  });
  return [...new Set([...lockSlotsForRange(startMinutes, endMinutes), ...legacy])];
}

function buildSlotLocks(dateKey, slot, orderNumber, startMinutes, endMinutes) {
  const lockSlots = lockSlotsForRange(startMinutes, endMinutes);
  return lockSlots.map(lockSlot => ({
    id: `${dateKey}_${lockSlot}`,
    slot: lockSlot,
    data: {
      dateKey,
      slot: lockSlot,
      startSlot: slot,
      startMinutes,
      endMinutes,
      durationMinutes: endMinutes - startMinutes,
      orderNumber,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
  }));
}

function bookingServiceIds(booking) {
  return uniqueServiceIds(booking?.serviceIds?.length ? booking.serviceIds : serviceIdsFromEventType(booking?.eventType));
}

function bookingServices(booking) {
  const ids = bookingServiceIds(booking);
  return serviceSnapshotFromIds(ids);
}

function bookingServiceLabel(booking) {
  return serviceNamesFromIds(bookingServiceIds(booking)).join(' + ') || normalizeEventType(booking?.eventType || '');
}

function bookingPrice(booking) {
  return Number.isInteger(booking?.price) ? booking.price : serviceTotals(bookingServiceIds(booking)).price;
}

function bookingDuration(booking) {
  return Number.isInteger(booking?.totalDuration) ? booking.totalDuration : serviceTotals(bookingServiceIds(booking)).duration || 60;
}

function bookingStartMinutes(booking) {
  return Number.isInteger(booking?.startMinutes) ? booking.startMinutes : slotToMinutes(booking?.slot);
}

function bookingEndMinutes(booking) {
  const start = bookingStartMinutes(booking);
  return Number.isInteger(booking?.endMinutes) ? booking.endMinutes : (start ?? 0) + bookingDuration(booking);
}

function bookingHoursText(booking) {
  const start = bookingStartMinutes(booking);
  const end = bookingEndMinutes(booking);
  return Number.isInteger(start) && Number.isInteger(end) ? `${minutesToTime(start)}-${minutesToTime(end)}` : (booking?.hoursText || '');
}

function bookingOverlaps(booking, dateKey, start, end, ignoreId = '') {
  if (!booking || booking.id === ignoreId || booking.status === 'cancelled' || booking.dateKey !== dateKey) return false;
  const bStart = bookingStartMinutes(booking);
  const bEnd = bookingEndMinutes(booking);
  return Number.isInteger(bStart) && Number.isInteger(bEnd) && bStart < end && bEnd > start;
}

/** מתאים ל־isValidPhone בחוקי Firestore (^0\d{8,9}$) */
function normalizePhoneForFirestore(phoneRaw) {
  let d = String(phoneRaw || '').replace(/\D/g, '');
  if (/^972/.test(d) && d.length >= 11) d = '0' + d.slice(3);
  else if (/^5\d{8}$/.test(d)) d = '0' + d;
  return d;
}

// WhatsApp message templates
const WA_TEMPLATES = Object.freeze({
  deposit: (b) =>
    'שלום ' + b.fullName + ' 😊\n' +
    'תזכורת לגבי התור שלך ב-Moriya Nails: *' + bookingServiceLabel(b) + '* בתאריך *' + b.gregDate + '*.\n' +
    'אם יש שינוי או ביטול, נא לעדכן מראש. תודה!',

  confirmation: (b) =>
    'שלום ' + b.fullName + ' 🎉\n' +
    'התור שלך ב-Moriya Nails אושר!\n' +
    '📅 תאריך: *' + b.gregDate + '*\n' +
    '⏰ שעה: *' + bookingHoursText(b) + '*\n' +
    '💅 טיפולים: *' + bookingServiceLabel(b) + '*\n' +
    '🔢 מספר הזמנה: *' + b.orderNumber + '*' ,

  dayBefore: (b) =>
    'שלום ' + b.fullName + ' 👋\n' +
    'תזכורת: התור שלך ב-Moriya Nails מתקיים מחר.\n' +
    '📅 ' + b.gregDate + ' | ⏰ ' + bookingHoursText(b),

  thanks: (b) =>
    'שלום ' + b.fullName + ' 💛\n' +
    'תודה שבחרת ב-Moriya Nails לטיפול *' + bookingServiceLabel(b) + '*. נשמח לראותך שוב!',

  custom: () => '',
});


// ── LOGGER ─────────────────────────────────────────────────
const Logger = Object.freeze({
  info:    (m,d) => console.log   (`📘 [INFO] ${m}`, ...(d !== undefined ? [d] : [])),
  warn:    (m,d) => console.warn  (`⚠️ [WARN] ${m}`, ...(d !== undefined ? [d] : [])),
  error:   (m,d) => console.error (`❌ [ERR]  ${m}`, ...(d !== undefined ? [d] : [])),
  success: (m,d) => console.log   (`✅ [OK]   ${m}`, ...(d !== undefined ? [d] : [])),
});


// ── TOAST ───────────────────────────────────────────────────
const Toast = (() => {
  let _c = null;
  function _container() {
    if (_c) return _c;
    _c = Object.assign(document.createElement('div'), { id: 'toast-container' });
    _c.setAttribute('role', 'region'); _c.setAttribute('aria-live', 'polite');
    document.body.appendChild(_c); return _c;
  }
  function show(message, type = 'info', ms = 4500) {
    const icons  = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const colors = {
      success: { bg:'rgba(82,204,130,.12)', border:'rgba(82,204,130,.4)', text:'#52cc82' },
      error:   { bg:'rgba(224,92,92,.12)',  border:'rgba(224,92,92,.45)', text:'#e05c5c' },
      warning: { bg:'rgba(201,165,76,.12)', border:'rgba(201,165,76,.4)', text:'#c9a84c' },
      info:    { bg:'rgba(62,184,194,.12)', border:'rgba(62,184,194,.4)', text:'#3eb8c2' },
    };
    const c = colors[type] ?? colors.info;
    const t = document.createElement('div');
    t.setAttribute('role','alert');
    Object.assign(t.style, {
      pointerEvents:'auto', background:c.bg, border:`1px solid ${c.border}`,
      borderRadius:'12px', padding:'14px 18px', display:'flex',
      alignItems:'flex-start', gap:'10px', backdropFilter:'blur(20px)',
      width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,.5)',
      animation:'toastIn .3s cubic-bezier(.4,0,.2,1)', direction:'rtl',
    });
    t.innerHTML = `
      <span style="font-size:18px;flex-shrink:0;margin-top:1px">${icons[type]}</span>
      <span style="flex:1;font-family:Heebo,sans-serif;font-size:14px;line-height:1.6;color:${c.text};font-weight:500">${message}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:${c.text};cursor:pointer;font-size:16px;opacity:.6;padding:0;flex-shrink:0;margin-top:1px" aria-label="סגור">✕</button>`;
    _container().appendChild(t);
    if (ms > 0) setTimeout(() => {
      t.style.animation = 'toastOut .25s ease forwards';
      setTimeout(() => t.remove(), 260);
    }, ms);
  }
  return Object.freeze({
    success: (m,ms) => show(m,'success',ms),
    error:   (m,ms) => show(m,'error',  ms ?? 6000),
    warning: (m,ms) => show(m,'warning',ms),
    info:    (m,ms) => show(m,'info',   ms),
  });
})();


// ── CONFIRM DIALOG ──────────────────────────────────────────
function showConfirm(message, title = 'אישור פעולה', confirmLabel = 'אישור', danger = false) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" id="_confirmNo">ביטול</button>
          <button class="btn ${danger ? 'btn-cancel' : 'btn-approve'}" id="_confirmYes">${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#_confirmYes').addEventListener('click', () => cleanup(true));
    overlay.querySelector('#_confirmNo') .addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
  });
}


// ── RETRY HELPER ────────────────────────────────────────────
async function withRetry(fn, retries = 3, baseDelay = 800) {
  let last;
  for (let i = 1; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (i < retries) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i - 1)));
    }
  }
  throw last;
}

/**
 * Compress image file to base64 JPEG in a safe size for Firestore.
 * @param {File} file
 * @param {number} maxSizeKB
 * @returns {Promise<string>}
 */
function compressImageForFirestore(file, maxSizeKB = MANUAL_RECEIPT_COMPRESS_TARGET_KB) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = ({ target: { result } }) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MANUAL_RECEIPT_MAX_WIDTH) {
          height = Math.round((height * MANUAL_RECEIPT_MAX_WIDTH) / width);
          width = MANUAL_RECEIPT_MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        const maxBytes = maxSizeKB * 1024;
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxBytes && quality > 0.2) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > maxBytes) {
          canvas.width = Math.round(width * 0.65);
          canvas.height = Math.round(height * 0.65);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        }

        resolve(dataUrl);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}


// ── STATE ───────────────────────────────────────────────────
let allBookings     = [];
let currentMonth    = new Date().getMonth();
let currentYear     = new Date().getFullYear();
let _unsubscribe    = null;
let _isSubmitting   = false;
let _isEditSubmit   = false;
let _currentEditId  = null;
let _manualReceiptFile = null;
let _manualReceiptCompressed = '';
let _adminInitialized = false;   // guard so initAdmin wires listeners only once

// Filters & sort state
const _filters = {
  status:    'active',
  search:    '',
  eventType: '',
  dateFrom:  '',
  dateTo:    '',
};
let _sortField = 'date';
let _sortDir   = 'asc';

// Bulk selection state
let _selectedIds = new Set();
let _bulkMode    = false;


// ── AUTH (Firebase Authentication) ───────────────────────────
/** Map Firebase Auth error codes to Hebrew user messages. */
function _authErrorMessage(e) {
  switch (e?.code) {
    case 'auth/invalid-email':          return '❌ כתובת אימייל לא תקינה';
    case 'auth/user-disabled':          return '❌ המשתמש חסום';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':     return '❌ אימייל או סיסמה שגויים';
    case 'auth/too-many-requests':      return '❌ יותר מדי ניסיונות — נסו שוב מאוחר יותר';
    case 'auth/network-request-failed': return '❌ בעיית רשת — בדקו את החיבור';
    default:                            return '❌ שגיאה בהתחברות, נסו שוב';
  }
}

async function adminLogin() {
  const email    = document.getElementById('adminEmail')?.value.trim() ?? '';
  const pw       = document.getElementById('adminPassword')?.value ?? '';
  const err      = document.getElementById('loginError');
  const btn      = document.querySelector('.btn-login');
  const btnLabel = btn?.querySelector('span');

  const showErr = (msg) => {
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(() => (err.style.display = 'none'), 4000);
  };

  if (!email || !pw) { showErr('❌ נא להזין אימייל וסיסמה'); return; }

  if (btn) btn.disabled = true;
  if (btnLabel) btnLabel.textContent = 'מתחבר…';

  try {
    // Session-scoped login (matches the previous behaviour; safer on shared devices).
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await auth.signInWithEmailAndPassword(email, pw);
    if (err) err.style.display = 'none';
    // _onAuthStateChanged reveals the panel.
  } catch (e) {
    Logger.error('adminLogin failed', e);
    showErr(_authErrorMessage(e));
    const pwEl = document.getElementById('adminPassword');
    pwEl?.classList.add('shake');
    setTimeout(() => pwEl?.classList.remove('shake'), 500);
  } finally {
    if (btn) btn.disabled = false;
    if (btnLabel) btnLabel.textContent = 'כניסה למערכת';
  }
}

async function adminLogout() {
  try { await auth.signOut(); }
  catch (e) { Logger.error('adminLogout failed', e); }
  // _onAuthStateChanged performs the UI teardown.
}

function _teardown() {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
}

/** Reflect Firebase auth state in the UI. Fires on load and on every login/logout. */
function _onAuthStateChanged(user) {
  const loginScreen = document.getElementById('loginScreen');
  const adminPanel  = document.getElementById('adminPanel');

  if (user) {
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminPanel)  adminPanel.style.display  = 'block';
    initAdmin();
  } else {
    _teardown();
    allBookings = [];
    _selectedIds.clear();
    _bulkMode = false;
    if (adminPanel)  adminPanel.style.display  = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';
    const pwEl = document.getElementById('adminPassword');
    if (pwEl) pwEl.value = '';
  }
}


// ── INIT ────────────────────────────────────────────────────
function initAdmin() {
  if (!_adminInitialized) {
    document.getElementById('adminPrevMonth')?.addEventListener('click', () => {
      currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar();
    });
    document.getElementById('adminNextMonth')?.addEventListener('click', () => {
      currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar();
    });
    _adminInitialized = true;
  }
  _startRealtimeListener();
}


// ── REAL-TIME LISTENER ──────────────────────────────────────
function _startRealtimeListener() {
  _teardown();
  _unsubscribe = db.collection('bookings')
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snapshot => {
        allBookings = [];
        snapshot.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          data.serviceIds = bookingServiceIds(data);
          data.services = data.services?.length ? data.services : bookingServices(data);
          data.eventType = bookingServiceLabel(data);
          data.price = bookingPrice(data);
          data.totalDuration = bookingDuration(data);
          data.startMinutes = bookingStartMinutes(data);
          data.endMinutes = bookingEndMinutes(data);
          data.endTimeText = Number.isInteger(data.endMinutes) ? minutesToTime(data.endMinutes) : '';
          data.hoursText = bookingHoursText(data);
          data.effectiveStatus = getEffectiveStatus(data);
          allBookings.push(data);
        });
        allBookings.sort((a, b) =>
          (a.dateKey ?? '9999-99-99').localeCompare(b.dateKey ?? '9999-99-99')
        );
        updateStats();
        renderCalendar();
        renderBookingsList();
        renderNotifications();
        renderAnalytics();
      },
      err => {
        Logger.error('Firestore listener error', err);
        Toast.error('שגיאה בטעינת ההזמנות — נסו לרענן את הדף');
      }
    );
}

async function loadAllBookings() { /* no-op: real-time handles it */ }


// ── STATUS HELPERS ──────────────────────────────────────────
function isBookingPast(booking) {
  if (!booking.dateKey) return false;
  const [y, m, d] = booking.dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  return date < today;
}

function getEffectiveStatus(booking) {
  if (booking.status === 'cancelled') return 'cancelled';
  if (isBookingPast(booking)) return 'completed';
  return 'approved';
}

function _daysUntil(dateKey) {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today  = new Date(); today.setHours(0,0,0,0);
  return Math.round((target - today) / 86400000);
}


// ── STATS ───────────────────────────────────────────────────
function updateStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const active    = allBookings.filter(b => b.effectiveStatus === 'approved');
  const completed = allBookings.filter(b => b.effectiveStatus === 'completed');
  const cancelled = allBookings.filter(b => b.effectiveStatus === 'cancelled');

  set('statTotal',     allBookings.length);
  set('statApproved',  active.length);
  set('statCompleted', completed.length);
  set('statCancelled', cancelled.length);

  // Revenue stat
  const totalRev = allBookings
    .filter(b => b.effectiveStatus !== 'cancelled')
    .reduce((sum, b) => sum + (b.price ?? 0), 0);
  const revEl = document.getElementById('statRevenue');
  if (revEl) revEl.textContent = `₪${totalRev.toLocaleString('he-IL')}`;

  // Deposit pending badge in header
  const pendingDeposit = active.filter(b => !b.depositPaid).length;
  const depBadge = document.getElementById('depositPendingBadge');
  if (depBadge) {
    depBadge.textContent = pendingDeposit;
    depBadge.style.display = pendingDeposit > 0 ? 'inline-flex' : 'none';
  }
}


// ── TABS ────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  ['calendarTab','bookingsTab','analyticsTab'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === tab + 'Tab');
  });
  if (tab === 'analytics') renderAnalytics();
}


// ── CALENDAR ────────────────────────────────────────────────
function renderCalendar() {
  const grid  = document.getElementById('adminCalendarGrid');
  const title = document.getElementById('adminCurrentMonth');
  if (!grid || !title) return;

  title.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const headers = [...grid.querySelectorAll('.cal-header')];
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  headers.forEach(h => frag.appendChild(h));

  const firstDow    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today       = new Date(); today.setHours(0,0,0,0);

  const bookedMap = {};
  allBookings.forEach(b => {
    if (b.status === 'cancelled' || !b.dateKey) return;
    (bookedMap[b.dateKey] ??= []).push(b);
  });

  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div'); e.className = 'cal-day empty'; frag.appendChild(e);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date    = new Date(currentYear, currentMonth, day);
    const dateKey = formatDateKey(date);
    const dow     = date.getDay();
    const isPast  = date < today;
    const isToday = date.getTime() === today.getTime();
    const dayBkgs = bookedMap[dateKey] ?? [];

    const cell = document.createElement('div');
    let cls = 'cal-day';
    if (isPast)  cls += ' past';
    if (isToday) cls += ' today';
    cell.className = cls;
    cell.innerHTML = `
      <div class="cal-day-number">${day}</div>
      <div class="cal-day-slots">${_buildAdminSlotsHTML(dow, dayBkgs, dateKey, isPast)}</div>`;
    frag.appendChild(cell);
  }
  grid.appendChild(frag);
}

function _buildAdminSlotsHTML(dow, bookings, dateKey, isPast) {
  if (!isBookableDow(dow)) return '<span class="cal-slot gray">סגור</span>';

  const activeBookings = bookings
    .filter(b => b.status !== 'cancelled')
    .sort((a, b) => (bookingStartMinutes(a) ?? 0) - (bookingStartMinutes(b) ?? 0));

  const chips = activeBookings.slice(0, 4).map(booking => {
    const cls = isPast ? 'completed-slot' : 'red';
    const dep = (!isPast && !booking.depositPaid) ? ' ●' : '';
    return `<span class="cal-slot ${cls}" onclick="openBookingModal('${booking.id}')">${bookingHoursText(booking)}: ${_esc(booking.fullName || 'תפוס')}${dep}</span>`;
  });

  if (activeBookings.length > 4) {
    chips.push(`<span class="cal-slot gray">+${activeBookings.length - 4} נוספים</span>`);
  }

  if (!isPast) {
    chips.push(`<span class="cal-slot green" onclick="openAddEventWithDate('${dateKey}','')">+ תור חדש</span>`);
  }

  if (chips.length === 0) {
    chips.push(`<span class="cal-slot green">${workingHoursForDow(dow)?.label || ''} פנוי</span>`);
  }

  return chips.join('');
}

function _esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _renderReceiptHtml(booking) {
  const receiptSrc = booking?.receiptImage || booking?.receipt_image || '';
  if (!receiptSrc) {
    return '<div class="modal-detail"><strong>📎 אסמכתא:</strong> לא צורפה</div>';
  }

  const safeSrc = String(receiptSrc).trim();
  const isDataImage = safeSrc.startsWith('data:image/');
  const isHttpImage = /^https?:\/\//i.test(safeSrc);
  if (!isDataImage && !isHttpImage) {
    return '<div class="modal-detail"><strong>📎 אסמכתא:</strong> צורפה בפורמט לא נתמך להצגה</div>';
  }

  return `
    <div class="modal-detail modal-detail--receipt">
      <strong>📎 אסמכתא:</strong>
      <div class="receipt-preview-wrap">
        <a href="${safeSrc}" target="_blank" rel="noopener noreferrer" title="פתח אסמכתא בגודל מלא">
          <img src="${safeSrc}" alt="אסמכתא לתשלום" class="receipt-preview-img-admin">
        </a>
      </div>
    </div>`;
}


// ── BOOKINGS LIST ────────────────────────────────────────────
function renderBookingsList() { filterBookings(); }

function filterBookings() {
  _filters.status    = document.getElementById('statusFilter')?.value ?? 'active';
  _filters.search    = document.getElementById('searchInput')?.value.trim().toLowerCase() ?? '';
  _filters.eventType = document.getElementById('eventTypeFilter')?.value ?? '';
  _filters.dateFrom  = document.getElementById('dateFromFilter')?.value ?? '';
  _filters.dateTo    = document.getElementById('dateToFilter')?.value ?? '';

  const list = document.getElementById('bookingsList');
  if (!list) return;

  let filtered = [...allBookings];

  // Status
  if (_filters.status === 'active')         filtered = filtered.filter(b => b.effectiveStatus === 'approved');
  else if (_filters.status === 'completed') filtered = filtered.filter(b => b.effectiveStatus === 'completed');
  else if (_filters.status === 'cancelled') filtered = filtered.filter(b => b.effectiveStatus === 'cancelled');
  else if (_filters.status === 'no-deposit') filtered = filtered.filter(b => b.effectiveStatus === 'approved' && !b.depositPaid);

  // Event type
  if (_filters.eventType) {
    const filterId = serviceIdFromValue(_filters.eventType);
    filtered = filtered.filter(b => bookingServiceIds(b).includes(filterId));
  }

  // Date range
  if (_filters.dateFrom) filtered = filtered.filter(b => (b.dateKey ?? '') >= _filters.dateFrom);
  if (_filters.dateTo)   filtered = filtered.filter(b => (b.dateKey ?? '') <= _filters.dateTo);

  // Text search
  if (_filters.search) {
    filtered = filtered.filter(b =>
      (b.fullName    ?? '').toLowerCase().includes(_filters.search) ||
      (b.phone       ?? '').includes(_filters.search) ||
      (b.orderNumber ?? '').toLowerCase().includes(_filters.search) ||
      bookingServiceLabel(b).toLowerCase().includes(_filters.search) ||
      (b.notes       ?? '').toLowerCase().includes(_filters.search)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let va, vb;
    if (_sortField === 'date')  { va = a.dateKey ?? ''; vb = b.dateKey ?? ''; }
    if (_sortField === 'name')  { va = a.fullName ?? ''; vb = b.fullName ?? ''; }
    if (_sortField === 'price') { va = a.price ?? 0; vb = b.price ?? 0; }
    if (_sortField === 'status') { va = a.effectiveStatus ?? ''; vb = b.effectiveStatus ?? ''; }
    if (_sortDir === 'asc')  return va > vb ? 1 : va < vb ? -1 : 0;
    if (_sortDir === 'desc') return va < vb ? 1 : va > vb ? -1 : 0;
    return 0;
  });

  // Update result count
  const countEl = document.getElementById('resultCount');
  if (countEl) countEl.textContent = `${filtered.length} תוצאות`;

  if (filtered.length === 0) {
    list.innerHTML = '<div class="no-results">לא נמצאו הזמנות</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(b => {
    const days    = _daysUntil(b.dateKey);
    const isSoon  = days !== null && days >= 0 && days <= 7;
    const isSelected = _selectedIds.has(b.id);

    const row = document.createElement('div');
    row.className = `booking-row${b.effectiveStatus !== 'approved' ? ' faded-row' : ''}${isSoon ? ' booking-soon' : ''}${isSelected ? ' booking-selected' : ''}`;
    row.dataset.id = b.id;

    // Deposit badge
    const depBadge = b.effectiveStatus === 'approved'
      ? b.depositPaid
        ? '<span class="dep-badge dep-paid">תשלום ✓</span>'
        : '<span class="dep-badge dep-unpaid">ממתין לתשלום</span>'
      : '';

    // Days countdown
    const countdownBadge = (b.effectiveStatus === 'approved' && days !== null && days >= 0)
      ? `<span class="days-badge${days <= 3 ? ' days-urgent' : ''}">${days === 0 ? 'היום!' : `${days}י`}</span>`
      : '';

    row.innerHTML = `
      ${_bulkMode ? `<div class="bulk-check"><input type="checkbox" ${isSelected ? 'checked' : ''} onclick="toggleSelectBooking(event,'${b.id}')"></div>` : ''}
      <div class="booking-info" onclick="openBookingModal('${b.id}')">
        <strong>${_esc(b.fullName ?? '')}</strong>
        <span>${_esc(bookingServiceLabel(b))} · ${formatDuration(bookingDuration(b))}</span>
        <div class="booking-badges">${depBadge}${countdownBadge}</div>
      </div>
      <div class="booking-date" onclick="openBookingModal('${b.id}')">
        <span>${_shortDate(b.dateKey ?? '')}</span>
        <span>${bookingHoursText(b)}</span>
      </div>
      <div class="booking-price" onclick="openBookingModal('${b.id}')">₪${bookingPrice(b).toLocaleString('he-IL')}</div>
      <span class="status-badge ${b.effectiveStatus}" onclick="openBookingModal('${b.id}')">${STATUS_LABELS[b.effectiveStatus] ?? ''}</span>
      <div class="row-quick-actions">
        ${b.effectiveStatus === 'approved' ? `
          <button class="qa-btn qa-wa"  onclick="openWaModal('${b.id}')"      title="WhatsApp">💬</button>
          <button class="qa-btn qa-dep" onclick="quickToggleDeposit('${b.id}')" title="${b.depositPaid ? 'תשלום שולם — לחץ לבטל' : 'סמן תשלום שולם'}">
            ${b.depositPaid ? '✅' : '💰'}
          </button>
          <button class="qa-btn qa-edit" onclick="openEditModal('${b.id}')"   title="עריכה">✏️</button>
        ` : ''}
      </div>`;
    frag.appendChild(row);
  });

  list.innerHTML = '';
  list.appendChild(frag);
}

function _shortDate(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

function setSort(field) {
  if (_sortField === field) { _sortDir = _sortDir === 'asc' ? 'desc' : 'asc'; }
  else { _sortField = field; _sortDir = 'asc'; }
  // Update sort button labels
  document.querySelectorAll('.sort-btn').forEach(b => {
    b.classList.toggle('sort-active', b.dataset.sort === field);
    if (b.dataset.sort === field) {
      b.querySelector('.sort-arrow').textContent = _sortDir === 'asc' ? '↑' : '↓';
    } else {
      b.querySelector('.sort-arrow').textContent = '';
    }
  });
  filterBookings();
}

function clearFilters() {
  const ids = ['searchInput','eventTypeFilter','dateFromFilter','dateToFilter'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const sf = document.getElementById('statusFilter');
  if (sf) sf.value = 'active';
  _sortField = 'date'; _sortDir = 'asc';
  filterBookings();
  Toast.info('הפילטרים אופסו');
}


// ── BOOKING DETAIL MODAL ─────────────────────────────────────
function openBookingModal(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;

  document.getElementById('modalTitle').textContent = `הזמנה #${b.orderNumber ?? ''}`;

  const depStatus = b.effectiveStatus === 'approved'
    ? b.depositPaid
      ? '<span style="color:var(--green);font-weight:700">✅ שולם</span>'
      : '<span style="color:var(--orange);font-weight:700">⏳ ממתין</span>'
    : '—';

  const days = _daysUntil(b.dateKey);
  const countdownHtml = (b.effectiveStatus === 'approved' && days !== null && days >= 0)
    ? `<div class="modal-detail"><strong>⏱️ עד לתור:</strong> ${days === 0 ? '<span style="color:var(--red)">היום!</span>' : `<span style="color:var(--orange)">${days} ימים</span>`}</div>`
    : '';

  const notesHtml = b.adminNotes
    ? `<div class="modal-detail modal-detail--notes"><strong>🗒️ הערות פנימיות:</strong><span>${_esc(b.adminNotes)}</span></div>`
    : '';

  const createdAt = b.createdAt?.toDate?.()
    ? new Date(b.createdAt.toDate()).toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '—';

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-detail"><strong>👤 שם:</strong> ${_esc(b.fullName ?? '')}</div>
    <div class="modal-detail"><strong>📱 טלפון:</strong> <a href="tel:${b.phone}">${_esc(b.phone ?? '')}</a></div>
    <div class="modal-detail"><strong>💅 טיפולים:</strong> ${_esc(bookingServiceLabel(b))}</div>
    <div class="modal-detail"><strong>🏠 סיווג:</strong> ${_esc(b.residentText ?? '')}</div>
    <div class="modal-detail"><strong>📅 תאריך:</strong> ${b.gregDate ?? ''}</div>
    <div class="modal-detail"><strong>⏰ שעות:</strong> ${_esc(bookingHoursText(b))}</div>
    <div class="modal-detail"><strong>⏱️ משך כולל:</strong> ${formatDuration(bookingDuration(b))}</div>
    ${countdownHtml}
    <div class="modal-detail"><strong>💰 מחיר:</strong> ₪${bookingPrice(b).toLocaleString('he-IL')}</div>
    <div class="modal-detail"><strong>💳 תשלום:</strong> ${depStatus}</div>
    ${_renderReceiptHtml(b)}
    <div class="modal-detail"><strong>📝 הערות:</strong> <span style="white-space:pre-wrap">${_esc(b.notes || 'אין')}</span></div>
    ${notesHtml}
    <div class="modal-detail"><strong>📊 סטטוס:</strong> <span class="status-badge ${b.effectiveStatus}">${STATUS_LABELS[b.effectiveStatus] ?? ''}</span></div>
    <div class="modal-detail modal-detail--meta"><strong>🔢 מס' הזמנה:</strong> ${_esc(b.orderNumber ?? '')} · ${b.source === 'admin-manual' ? '🖊️ ידני' : '🌐 אתר'}</div>
    <div class="modal-detail modal-detail--meta"><strong>📆 נוצר:</strong> ${createdAt}</div>
  `;

  let actions = '';
  if (b.effectiveStatus === 'approved') {
    actions = `
      <button class="btn btn-whatsapp"  onclick="openWaModal('${bookingId}')">💬 WhatsApp</button>
      <button class="btn btn-deposit ${b.depositPaid ? 'btn-deposit-paid' : ''}" onclick="quickToggleDeposit('${bookingId}')">
        ${b.depositPaid ? '✅ תשלום שולם' : '💰 סמן תשלום'}
      </button>
      <button class="btn btn-edit"      onclick="openEditModal('${bookingId}')">✏️ עריכה</button>
      <button class="btn btn-cancel"    onclick="confirmCancel('${bookingId}')">❌ בטל</button>`;
  } else if (b.effectiveStatus === 'cancelled' && !isBookingPast(b)) {
    actions = `
      <button class="btn btn-approve" onclick="updateBookingStatus('${bookingId}','approved')">🔄 שחזר</button>
      <button class="btn btn-edit"    onclick="openEditModal('${bookingId}')">✏️ עריכה</button>`;
  } else {
    actions = `
      <button class="btn btn-secondary" onclick="openNoteModal('${bookingId}')">🗒️ הערה פנימית</button>
      <p style="flex:1;text-align:center;color:var(--text-muted);font-size:13px;align-self:center;">התור הסתיים</p>`;
  }
  // Always show notes button for active bookings
  if (b.effectiveStatus === 'approved') {
    actions += `<button class="btn btn-secondary" onclick="openNoteModal('${bookingId}')">🗒️ הערה</button>`;
  }

  document.getElementById('modalActions').innerHTML = actions;
  document.getElementById('bookingModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('bookingModal').style.display = 'none';
}


// ── DEPOSIT TRACKING ─────────────────────────────────────────
async function quickToggleDeposit(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;
  const newVal = !b.depositPaid;
  try {
    await withRetry(() => db.collection('bookings').doc(bookingId).update({ depositPaid: newVal }));
    b.depositPaid = newVal;
    newVal
      ? Toast.success(`תשלום סומן כשולם עבור ${b.fullName}`)
      : Toast.warning(`תשלום סומן כלא שולם עבור ${b.fullName}`);
    closeModal();
    updateStats();
    renderCalendar();
    renderBookingsList();
    renderNotifications();
  } catch(err) {
    Logger.error('quickToggleDeposit', err);
    Toast.error('שגיאה בעדכון התשלום');
  }
}


// ── CANCEL / RESTORE ─────────────────────────────────────────
async function confirmCancel(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;
  const ok = await showConfirm(
    `האם לבטל את ההזמנה של <strong>${_esc(b.fullName ?? '')}</strong>?`,
    'ביטול הזמנה', 'כן, בטל', true
  );
  if (ok) await updateBookingStatus(bookingId, 'cancelled');
}

async function updateBookingStatus(bookingId, newStatus) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;
  const bookingRef = db.collection('bookings').doc(bookingId);
  const startMinutes = bookingStartMinutes(b);
  const endMinutes = bookingEndMinutes(b);

  try {
    if (newStatus === 'cancelled') {
      const batch = db.batch();
      batch.update(bookingRef, { status: 'cancelled' });
      deleteBookingLocks(batch, b);
      await withRetry(() => batch.commit());

    } else if (newStatus === 'approved') {
      await withRetry(() => db.runTransaction(async (tx) => {
        if (b.dateKey && b.slot && Number.isInteger(startMinutes) && Number.isInteger(endMinutes)) {
          const probeRefs = lockProbeSlotsForRange(startMinutes, endMinutes).map(lockSlot => _slotRef(b.dateKey, lockSlot));
          for (const ref of probeRefs) {
            const snap = await tx.get(ref);
            if (snap.exists && snap.data()?.orderNumber !== b.orderNumber) {
              throw new Error('SLOT_TAKEN');
            }
          }
          tx.update(bookingRef, { status: 'approved' });
          buildSlotLocks(b.dateKey, b.slot, b.orderNumber ?? '', startMinutes, endMinutes).forEach(lock => {
            tx.set(_slotRef(b.dateKey, lock.slot), lock.data);
          });
        } else {
          tx.update(bookingRef, { status: 'approved' });
        }
      }));

    } else {
      await withRetry(() => bookingRef.update({ status: newStatus }));
    }

    b.status = newStatus; b.effectiveStatus = getEffectiveStatus(b);
    closeModal();
    updateStats(); renderCalendar(); renderBookingsList();
    newStatus === 'cancelled' ? Toast.warning('ההזמנה בוטלה') : Toast.success('ההזמנה שוחזרה');
  } catch(err) {
    Logger.error('updateBookingStatus', err);
    Toast.error(err?.message === 'SLOT_TAKEN'
      ? 'לא ניתן לשחזר — הטווח נתפס בינתיים'
      : 'שגיאה בעדכון ההזמנה');
  }
}

function deleteBookingLocks(batch, booking) {
  if (!booking?.dateKey) return;
  const start = bookingStartMinutes(booking);
  const end = bookingEndMinutes(booking);
  const slots = booking.lockSlots?.length
    ? booking.lockSlots
    : (Number.isInteger(start) && Number.isInteger(end) ? lockProbeSlotsForRange(start, end) : [booking.slot].filter(Boolean));
  [...new Set(slots.filter(Boolean))].forEach(slot => batch.delete(_slotRef(booking.dateKey, slot)));
}


// ── EDIT BOOKING MODAL ───────────────────────────────────────
function openEditModal(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;
  _currentEditId = bookingId;

  // Create edit modal if it doesn't exist
  if (!document.getElementById('editEventModal')) _createEditModal();

  const f = {
    fullName:  document.getElementById('editFullName'),
    phone:     document.getElementById('editPhone'),
    eventType: document.getElementById('editEventType'),
    resident:  document.getElementById('editResident'),
    date:      document.getElementById('editDate'),
    slot:      document.getElementById('editSlot'),
    projector: document.getElementById('editProjector'),
    price:     document.getElementById('editPrice'),
    notes:     document.getElementById('editNotes'),
    deposit:   document.getElementById('editDepositPaid'),
  };

  if (f.fullName)  f.fullName.value  = b.fullName  ?? '';
  if (f.phone)     f.phone.value     = b.phone     ?? '';
  renderServiceChoices('editServiceGrid', 'editServiceIds', bookingServiceIds(b));
  if (f.eventType) f.eventType.value = bookingServiceLabel(b);
  if (f.resident)  f.resident.value  = 'לקוחה';
  if (f.date)      f.date.value      = b.dateKey   ?? '';
  updateAdminTreatmentFields('edit', bookingId);
  if (f.slot)      f.slot.value      = b.slot      ?? '';
  if (f.projector) f.projector.checked = b.projector ?? false;
  if (f.price)     f.price.value     = b.price     ?? 0;
  if (f.notes)     f.notes.value     = b.notes     ?? '';
  if (f.deposit)   f.deposit.checked = b.depositPaid ?? false;

  closeModal();
  document.getElementById('editEventModal').style.display = 'flex';
}

function _createEditModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'editEventModal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-card modal-card-large">
      <div class="modal-header">
        <h2>✏️ עריכת הזמנה</h2>
        <button class="btn-close" onclick="closeEditModal()" aria-label="סגור">✕</button>
      </div>
      <div class="modal-body">
        <form id="editEventForm" onsubmit="return false;">
          <div class="form-row">
            <div class="form-group">
              <label>👤 שם מלא *</label>
              <input type="text" id="editFullName" required placeholder="שם מלא">
            </div>
            <div class="form-group">
              <label>📱 טלפון *</label>
              <input type="tel" id="editPhone" required placeholder="050-0000000">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>💅 סוגי טיפול *</label>
              <input type="hidden" id="editEventType" required>
              <div class="admin-service-grid" id="editServiceGrid" role="group" aria-label="בחירת סוגי טיפול"></div>
            </div>
            <div class="form-group">
              <label>🏠 סיווג לקוחה</label>
              <select id="editResident">
                <option value="לקוחה">לקוחה</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>📅 תאריך *</label>
              <input type="date" id="editDate" required>
            </div>
            <div class="form-group">
              <label>⏰ שעה *</label>
              <select id="editSlot" required><option value="">בחרי תאריך וטיפולים</option></select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>💰 מחיר (₪)</label>
              <div class="price-breakdown" id="editPriceBreakdown">בחרי סוג טיפול</div>
              <input type="number" id="editPrice" min="0" placeholder="0">
            </div>
            <div class="form-group">
              <label>💳 סטטוס תשלום</label>
              <label class="checkbox-wrapper" for="editDepositPaid">
                <input type="checkbox" id="editDepositPaid">
                <span>תשלום שולם</span>
              </label>
            </div>
          </div>
          <input type="checkbox" id="editProjector" hidden>
          <div class="form-group">
            <label>📝 הערות</label>
            <textarea id="editNotes" rows="3" placeholder="הערות לתור…"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-actions">
        <button class="btn btn-approve" onclick="submitEditBooking()">💾 שמור שינויים</button>
        <button class="btn btn-secondary" onclick="closeEditModal()">ביטול</button>
        <button class="btn btn-cancel" style="margin-right:auto" onclick="confirmDeleteBooking()">🗑️ מחק לצמיתות</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('editDate')?.addEventListener('change', () => updateAdminTreatmentFields('edit', _currentEditId));
  document.getElementById('editSlot')?.addEventListener('change', () => updateAdminTreatmentFields('edit', _currentEditId));
}

function closeEditModal() {
  const m = document.getElementById('editEventModal');
  if (m) m.style.display = 'none';
  _currentEditId = null;
}

async function submitEditBooking() {
  if (_isEditSubmit || !_currentEditId) return;
  const b = allBookings.find(x => x.id === _currentEditId);
  if (!b) return;

  const fullName  = document.getElementById('editFullName')?.value.trim() ?? '';
  const phoneRaw  = document.getElementById('editPhone')?.value.trim()    ?? '';
  const phone     = normalizePhoneForFirestore(phoneRaw);
  const serviceIds = selectedServiceIdsByName('editServiceIds');
  const services = serviceSnapshotFromIds(serviceIds);
  const totals = serviceTotals(serviceIds);
  const eventType = serviceNamesFromIds(serviceIds).join(', ');
  const resident  = document.getElementById('editResident')?.value        ?? '';
  const dateKey   = document.getElementById('editDate')?.value            ?? '';
  const slot      = document.getElementById('editSlot')?.value            ?? '';
  const notes     = document.getElementById('editNotes')?.value.trim()    ?? '';
  const depositPaid = document.getElementById('editDepositPaid')?.checked ?? false;
  const startMinutes = slotToMinutes(slot);
  const endMinutes = startMinutes + totals.duration;

  if (!fullName || !phone || serviceIds.length === 0 || !dateKey || !slot) {
    Toast.warning('נא למלא את כל השדות החובה'); return;
  }
  if (!/^0\d{8,9}$/.test(phone)) {
    Toast.warning('טלפון לא תקין — הזינו מספר ישראלי עם 0 (למשל 0501234567)');
    return;
  }
  const editDow = new Date(dateKey + 'T00:00:00').getDay();
  if (!isValidSlot(slot)) {
    Toast.warning('שעה לא תקינה');
    return;
  }
  if (!isBookableDow(editDow)) {
    Toast.warning('אין קבלת תורים ביום הזה');
    return;
  }
  if (endMinutes > (workingHoursForDow(editDow)?.end || 0)) {
    Toast.warning('התור חורג משעת הסגירה');
    return;
  }

  const conflict = allBookings.find(x => bookingOverlaps(x, dateKey, startMinutes, endMinutes, _currentEditId));
  if (conflict) { Toast.error(`הטווח חופף לתור של ${conflict.fullName}`); return; }

  _isEditSubmit = true;
  const saveBtn = document.querySelector('#editEventModal .btn-approve');
  if (saveBtn) { saveBtn.textContent = '⏳ שומר...'; saveBtn.disabled = true; }

  const updates = {
    fullName, phone, eventType,
    serviceIds,
    services,
    totalDuration: totals.duration,
    residentText: resident,
    dateKey,
    gregDate: formatGregDate(dateKey),
    slot,
    slotText:  minutesToTime(startMinutes),
    hoursText: `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`,
    startMinutes,
    endMinutes,
    endTimeText: minutesToTime(endMinutes),
    lockSlots: lockSlotsForRange(startMinutes, endMinutes),
    projector: false,
    price: totals.price,
    notes,
    depositPaid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const bookingRef = db.collection('bookings').doc(_currentEditId);
  const slotChanged = dateKey !== b.dateKey || slot !== b.slot || startMinutes !== bookingStartMinutes(b) || endMinutes !== bookingEndMinutes(b);
  const isActive = b.status !== 'cancelled';

  try {
    if (slotChanged && isActive) {
      await withRetry(() => db.runTransaction(async (tx) => {
        const probeRefs = lockProbeSlotsForRange(startMinutes, endMinutes).map(lockSlot => _slotRef(dateKey, lockSlot));
        for (const ref of probeRefs) {
          const snap = await tx.get(ref);
          if (snap.exists && snap.data()?.orderNumber !== b.orderNumber) {
            throw new Error('SLOT_TAKEN');
          }
        }
        tx.update(bookingRef, updates);
        deleteBookingLocks(tx, b);
        buildSlotLocks(dateKey, slot, b.orderNumber ?? '', startMinutes, endMinutes).forEach(lock => {
          tx.set(_slotRef(dateKey, lock.slot), lock.data);
        });
      }));
    } else {
      await withRetry(() => bookingRef.update(updates));
    }
    Object.assign(b, updates);
    b.effectiveStatus = getEffectiveStatus(b);
    closeEditModal();
    Toast.success('ההזמנה עודכנה בהצלחה ✅');
  } catch(err) {
    Logger.error('submitEditBooking', err);
    Toast.error(err?.message === 'SLOT_TAKEN'
      ? 'השעה החדשה נתפסה — בחרו תאריך/שעה אחרים'
      : 'שגיאה בשמירת השינויים');
  } finally {
    _isEditSubmit = false;
    if (saveBtn) { saveBtn.textContent = '💾 שמור שינויים'; saveBtn.disabled = false; }
  }
}

async function confirmDeleteBooking() {
  if (!_currentEditId) return;
  const b = allBookings.find(x => x.id === _currentEditId);
  const ok = await showConfirm(
    `האם למחוק לצמיתות את ההזמנה של <strong>${_esc(b?.fullName ?? '')}</strong>?<br><small style="color:var(--red)">פעולה זו בלתי הפיכה!</small>`,
    '🗑️ מחיקה לצמיתות', 'כן, מחק', true
  );
  if (!ok) return;
  try {
    const batch = db.batch();
    batch.delete(db.collection('bookings').doc(_currentEditId));
    if (b?.status !== 'cancelled' && b?.dateKey && b?.slot) {
      deleteBookingLocks(batch, b);
    }
    await withRetry(() => batch.commit());
    closeEditModal();
    Toast.warning('ההזמנה נמחקה לצמיתות');
  } catch(err) {
    Logger.error('deleteBooking', err);
    Toast.error('שגיאה במחיקה');
  }
}


// ── ADMIN NOTES ──────────────────────────────────────────────
function openNoteModal(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;

  if (!document.getElementById('noteModal')) _createNoteModal();
  document.getElementById('noteTextarea').value = b.adminNotes ?? '';
  document.getElementById('noteModal')._bookingId = bookingId;
  closeModal();
  document.getElementById('noteModal').style.display = 'flex';
}

function _createNoteModal() {
  const modal = document.createElement('div');
  modal.id = 'noteModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>🗒️ הערה פנימית</h2>
        <button class="btn-close" onclick="closeNoteModal()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">הערות פנימיות — גלויות רק למנהל</p>
        <textarea id="noteTextarea" rows="6" style="width:100%;padding:12px;border:1.5px solid var(--border-mid);border-radius:var(--r-sm);background:rgba(255,255,255,.04);color:var(--text-primary);font-family:Heebo,sans-serif;font-size:14px;direction:rtl;resize:vertical;" placeholder="הוסף הערה פנימית…"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-approve" onclick="saveAdminNote()">💾 שמור הערה</button>
        <button class="btn btn-secondary" onclick="closeNoteModal()">ביטול</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function closeNoteModal() {
  const m = document.getElementById('noteModal');
  if (m) m.style.display = 'none';
}

async function saveAdminNote() {
  const modal     = document.getElementById('noteModal');
  const bookingId = modal?._bookingId;
  const text      = document.getElementById('noteTextarea')?.value.trim() ?? '';
  if (!bookingId) return;
  try {
    await withRetry(() => db.collection('bookings').doc(bookingId).update({ adminNotes: text }));
    const b = allBookings.find(x => x.id === bookingId);
    if (b) b.adminNotes = text;
    closeNoteModal();
    Toast.success('ההערה נשמרה');
  } catch(err) {
    Logger.error('saveAdminNote', err);
    Toast.error('שגיאה בשמירת ההערה');
  }
}


// ── WHATSAPP TEMPLATES ───────────────────────────────────────
function openWaModal(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;

  if (!document.getElementById('waModal')) _createWaModal();
  document.getElementById('waModal')._bookingId = bookingId;
  _setWaTemplate('deposit', b);
  closeModal();
  document.getElementById('waModal').style.display = 'flex';
}

function _createWaModal() {
  const modal = document.createElement('div');
  modal.id = 'waModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-card modal-card-large">
      <div class="modal-header">
        <h2>💬 שליחת הודעת WhatsApp</h2>
        <button class="btn-close" onclick="closeWaModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="wa-template-tabs">
          <button class="wa-tab active" onclick="selectWaTemplate('deposit')"   data-tpl="deposit">💰 תשלום</button>
          <button class="wa-tab"        onclick="selectWaTemplate('confirmation')" data-tpl="confirmation">✅ אישור</button>
          <button class="wa-tab"        onclick="selectWaTemplate('dayBefore')" data-tpl="dayBefore">📅 יום לפני</button>
          <button class="wa-tab"        onclick="selectWaTemplate('thanks')"    data-tpl="thanks">💛 תודה</button>
          <button class="wa-tab"        onclick="selectWaTemplate('custom')"    data-tpl="custom">✏️ מותאם</button>
        </div>
        <textarea id="waMessageText" rows="8" style="width:100%;padding:14px;border:1.5px solid var(--border-mid);border-radius:var(--r-sm);background:rgba(255,255,255,.04);color:var(--text-primary);font-family:Heebo,sans-serif;font-size:14px;direction:rtl;resize:vertical;line-height:1.7;margin-top:14px;" placeholder="הודעה…"></textarea>
        <p id="waPhonePreview" style="font-size:12px;color:var(--text-muted);margin-top:8px;"></p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-whatsapp" onclick="sendWaMessage()">💬 שלח ב-WhatsApp</button>
        <button class="btn btn-secondary" onclick="closeWaModal()">ביטול</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function selectWaTemplate(tplKey) {
  const modal = document.getElementById('waModal');
  if (!modal) return;
  const b = allBookings.find(x => x.id === modal._bookingId);
  if (!b) return;
  document.querySelectorAll('.wa-tab').forEach(t => t.classList.toggle('active', t.dataset.tpl === tplKey));
  _setWaTemplate(tplKey, b);
}

function _setWaTemplate(tplKey, b) {
  const txt = document.getElementById('waMessageText');
  if (!txt) return;
  const fn = WA_TEMPLATES[tplKey];
  txt.value = fn ? fn(b) : '';
  if (tplKey === 'custom') txt.focus();
  const prev = document.getElementById('waPhonePreview');
  if (prev) prev.textContent = `📱 נשלח אל: ${b.phone ?? ''}`;
}

function closeWaModal() {
  const m = document.getElementById('waModal');
  if (m) m.style.display = 'none';
}

function sendWaMessage() {
  const modal = document.getElementById('waModal');
  const b = allBookings.find(x => x.id === modal?._bookingId);
  if (!b) return;
  const msg = document.getElementById('waMessageText')?.value ?? '';
  if (!msg.trim()) { Toast.warning('נא להזין הודעה'); return; }
  window.open(
    `https://wa.me/${formatPhoneForWhatsApp(b.phone)}?text=${encodeURIComponent(msg)}`,
    '_blank', 'noopener,noreferrer'
  );
  closeWaModal();
}

// Legacy kept for calendar onclick
function sendWhatsAppReminder(bookingId) { openWaModal(bookingId); }

function formatPhoneForWhatsApp(phone) {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  return p;
}


// ── NOTIFICATIONS ────────────────────────────────────────────
function toggleNotifications() {
  document.getElementById('notificationsSidebar')?.classList.toggle('open');
}

function renderNotifications() {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today); start.setDate(today.getDate() + ADMIN_CONFIG.NOTIF_DAYS_START);
  const end   = new Date(today); end.setDate(today.getDate()   + ADMIN_CONFIG.NOTIF_DAYS_END);

  // Also include bookings without deposit in the next 30 days
  const pending30 = new Date(today); pending30.setDate(today.getDate() + 30);

  const upcoming = allBookings
    .filter(b => {
      if (b.effectiveStatus !== 'approved' || !b.dateKey) return false;
      const [y, m, d] = b.dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date >= start && date <= end;
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const noDeposit = allBookings
    .filter(b => {
      if (b.effectiveStatus !== 'approved' || b.depositPaid || !b.dateKey) return false;
      const [y, m, d] = b.dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date >= today && date <= pending30;
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const total = upcoming.length + noDeposit.length;
  const countEl = document.getElementById('notifCount');
  if (countEl) countEl.textContent = total;

  const headerEl = document.querySelector('.sidebar-header h2');
  const startStr = start.toLocaleDateString('he-IL');
  const endStr   = end.toLocaleDateString('he-IL');
  if (headerEl) headerEl.textContent = `🔔 התראות (${total})`;

  const list = document.getElementById('notificationsList');
  if (!list) return;

  let html = '';

  if (noDeposit.length > 0) {
    html += `<div class="notif-section-title">💰 ממתינים לתשלום (30 יום)</div>`;
    noDeposit.forEach(b => {
      const days = _daysUntil(b.dateKey);
      html += `
        <div class="notif-card notif-card--deposit" onclick="openBookingModal('${b.id}');toggleNotifications()">
          <h3>${_esc(b.fullName ?? '')} — ${_esc(bookingServiceLabel(b))}</h3>
          <p>📅 ${b.gregDate ?? ''} · ${days}י</p>
          <p>📱 ${_esc(b.phone ?? '')}</p>
          <button class="qa-btn qa-wa notif-wa-btn" onclick="event.stopPropagation();openWaModal('${b.id}')">💬 שלח תזכורת</button>
        </div>`;
    });
  }

  if (upcoming.length > 0) {
    html += `<div class="notif-section-title">📅 תורים קרובים (${startStr}–${endStr})</div>`;
    upcoming.forEach(b => {
      html += `
        <div class="notif-card" onclick="openBookingModal('${b.id}');toggleNotifications()">
          <h3>${_esc(b.fullName ?? '')} — ${_esc(bookingServiceLabel(b))}</h3>
          <p>📅 ${b.gregDate ?? ''}</p>
          <p>⏰ ${_esc(bookingHoursText(b))} · ${b.depositPaid ? '✅ תשלום' : '⚠️ אין תשלום'}</p>
          <p>📱 ${_esc(b.phone ?? '')}</p>
        </div>`;
    });
  }

  if (total === 0) {
    html = `<p class="notif-empty">אין התראות פעילות ✨</p>`;
  }

  list.innerHTML = html;
}


// ── ANALYTICS TAB ────────────────────────────────────────────
function renderAnalytics() {
  const tab = document.getElementById('analyticsTab');
  if (!tab || !tab.classList.contains('active')) return;

  const year = new Date().getFullYear();
  const monthlyRev     = new Array(12).fill(0);
  const monthlyCount   = new Array(12).fill(0);
  const byEventType    = {};
  let totalRev = 0; let totalCount = 0;

  allBookings.forEach(b => {
    if (b.effectiveStatus === 'cancelled' || !b.dateKey) return;
    const m = parseInt(b.dateKey.split('-')[1], 10) - 1;
    const y = parseInt(b.dateKey.split('-')[0], 10);
    if (y === year) {
      monthlyRev[m]   += b.price ?? 0;
      monthlyCount[m] += 1;
    }
    totalRev   += b.price ?? 0;
    totalCount += 1;
    byEventType[b.eventType ?? 'אחר'] = (byEventType[b.eventType ?? 'אחר'] ?? 0) + 1;
  });

  const avgRev = totalCount > 0 ? Math.round(totalRev / totalCount) : 0;
  const busiestMonth = monthlyCount.indexOf(Math.max(...monthlyCount));

  // Key metrics
  const metrics = [
    { icon:'💰', label:'הכנסה כוללת (לא מבוטל)', value:`₪${totalRev.toLocaleString('he-IL')}` },
    { icon:'📊', label:`הכנסות ${year}`, value:`₪${monthlyRev.reduce((a,b)=>a+b,0).toLocaleString('he-IL')}` },
    { icon:'🏷️', label:'ממוצע לתור', value:`₪${avgRev.toLocaleString('he-IL')}` },
    { icon:'📅', label:'חודש עמוס ביותר', value:MONTH_NAMES[busiestMonth] ?? '—' },
    { icon:'💳', label:'תשלום שולם', value:`${allBookings.filter(b=>b.depositPaid&&b.effectiveStatus==='approved').length}/${allBookings.filter(b=>b.effectiveStatus==='approved').length}` },
    { icon:'🎯', label:'תפוסה השנה', value:`${Math.round(monthlyCount.reduce((a,b)=>a+b,0) / (new Date().getMonth()+1))} / חודש` },
  ];

  // Sort event types
  const evTypes = Object.entries(byEventType).sort((a,b) => b[1]-a[1]);
  const maxEv   = Math.max(...evTypes.map(e => e[1]), 1);

  // Build HTML
  tab.querySelector('.admin-card').innerHTML = `
    <div class="analytics-header">
      <h2 class="analytics-title">📊 ניתוח נתונים</h2>
      <div class="analytics-year-badge">${year}</div>
    </div>

    <div class="analytics-metrics">
      ${metrics.map(m => `
        <div class="analytics-metric-card">
          <span class="analytics-metric-icon">${m.icon}</span>
          <span class="analytics-metric-value">${m.value}</span>
          <span class="analytics-metric-label">${m.label}</span>
        </div>`).join('')}
    </div>

    <div class="analytics-charts-row">
      <div class="analytics-chart-box analytics-chart-box--wide">
        <h3>📈 הכנסות חודשיות ${year}</h3>
        <div class="bar-chart-wrap">
          ${monthlyRev.map((rev, i) => {
            const maxRev = Math.max(...monthlyRev, 1);
            const pct    = Math.round((rev / maxRev) * 100);
            const count  = monthlyCount[i];
            return `
              <div class="bar-col">
                <div class="bar-tooltip">₪${rev.toLocaleString('he-IL')}<br>${count} תורים</div>
                <div class="bar-inner" style="height:${pct}%;background:${rev > 0 ? 'var(--gold)' : 'var(--bg-surface-3)'}"></div>
                <div class="bar-label">${MONTH_NAMES[i].slice(0,3)}</div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="analytics-chart-box">
        <h3>🎉 סוגי תורים</h3>
        <div class="event-type-bars">
          ${evTypes.slice(0,8).map(([type, count]) => `
            <div class="et-row">
              <span class="et-label">${_esc(type)}</span>
              <div class="et-bar-wrap">
                <div class="et-bar" style="width:${Math.round((count/maxEv)*100)}%"></div>
              </div>
              <span class="et-count">${count}</span>
            </div>`).join('') || '<p style="color:var(--text-muted)">אין נתונים</p>'}
        </div>
      </div>
    </div>

    <div class="analytics-charts-row">
      <div class="analytics-chart-box">
        <h3>📅 תפוסה חודשית ${year}</h3>
        <div class="occupancy-grid">
          ${MONTH_NAMES.map((name, i) => {
            const cnt = monthlyCount[i];
            const max = SLOT_KEYS.length * 22; // rough monthly capacity across weekdays
            const pct = Math.min(Math.round((cnt / max) * 100), 100);
            const color = pct === 0 ? 'var(--bg-surface-3)' : pct < 30 ? 'var(--green)' : pct < 70 ? 'var(--orange)' : 'var(--red)';
            return `
              <div class="occ-cell" title="${name}: ${cnt} תורים">
                <div class="occ-bar" style="height:${Math.max(pct,4)}%;background:${color}"></div>
                <span>${name.slice(0,3)}</span>
                <strong style="color:${color}">${cnt}</strong>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="analytics-chart-box">
        <h3>💰 סטטוס פיקדונות</h3>
        <div class="deposit-status-wrap">
          ${(() => {
            const active  = allBookings.filter(b => b.effectiveStatus === 'approved');
            const paid    = active.filter(b => b.depositPaid).length;
            const unpaid  = active.length - paid;
            const paidPct = active.length > 0 ? Math.round((paid/active.length)*100) : 0;
            return `
              <div class="deposit-donut-wrap">
                <svg viewBox="0 0 36 36" class="deposit-donut">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--red-dim)" stroke-width="3.8"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--green)" stroke-width="3.8"
                    stroke-dasharray="${paidPct} ${100-paidPct}" stroke-dashoffset="25" stroke-linecap="round"/>
                  <text x="18" y="20.5" text-anchor="middle" font-size="8" fill="var(--gold)" font-weight="700" font-family="Frank Ruhl Libre">${paidPct}%</text>
                </svg>
              </div>
              <div class="deposit-legend">
                <div class="dep-leg-row"><span class="dep-leg-dot" style="background:var(--green)"></span> שולם: ${paid}</div>
                <div class="dep-leg-row"><span class="dep-leg-dot" style="background:var(--red)"></span> ממתין: ${unpaid}</div>
                <div class="dep-leg-row" style="color:var(--text-muted)">סה"כ פעיל: ${active.length}</div>
              </div>`;
          })()}
        </div>
      </div>
    </div>
  `;
}


// ── EXPORT CSV ───────────────────────────────────────────────
function exportCSV() {
  const status   = document.getElementById('statusFilter')?.value ?? 'all';
  const filtered = status === 'all' ? allBookings :
    status === 'active'    ? allBookings.filter(b => b.effectiveStatus === 'approved')  :
    status === 'completed' ? allBookings.filter(b => b.effectiveStatus === 'completed') :
    status === 'cancelled' ? allBookings.filter(b => b.effectiveStatus === 'cancelled') :
    allBookings.filter(b => b.effectiveStatus === 'approved' && !b.depositPaid);

  if (filtered.length === 0) { Toast.warning('אין הזמנות לייצוא'); return; }

  const cols = [
    'מספר הזמנה','שם','טלפון','סוג טיפול','סיווג',
    'תאריך','שעה','מחיר','תשלום שולם','סטטוס','הערות',
  ];

  const rows = filtered.map(b => [
    b.orderNumber ?? '',
    b.fullName    ?? '',
    b.phone       ?? '',
    bookingServiceLabel(b),
    b.residentText ?? '',
    b.dateKey     ?? '',
    bookingHoursText(b),
    bookingPrice(b),
    b.depositPaid ? 'כן' : 'לא',
    STATUS_LABELS[b.effectiveStatus] ?? '',
    (b.notes ?? '').replace(/"/g, '""'),
  ]);

  const BOM = '\uFEFF'; // UTF-8 BOM for Excel
  const csv = BOM + [cols, ...rows]
    .map(r => r.map(c => `"${c}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `הזמנות_Moriya_Nails_${new Date().toLocaleDateString('he-IL').replace(/\./g,'-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  Toast.success(`${filtered.length} הזמנות יוצאו בהצלחה`);
}


// ── BULK SELECT ──────────────────────────────────────────────
function toggleBulkMode() {
  _bulkMode = !_bulkMode;
  if (!_bulkMode) _selectedIds.clear();
  const btn = document.getElementById('bulkModeBtn');
  if (btn) btn.classList.toggle('active', _bulkMode);
  const bulkBar = document.getElementById('bulkActionBar');
  if (bulkBar) bulkBar.style.display = _bulkMode ? 'flex' : 'none';
  filterBookings();
}

function toggleSelectBooking(e, bookingId) {
  e.stopPropagation();
  if (_selectedIds.has(bookingId)) _selectedIds.delete(bookingId);
  else _selectedIds.add(bookingId);
  const countEl = document.getElementById('bulkSelectedCount');
  if (countEl) countEl.textContent = `${_selectedIds.size} נבחרו`;
  filterBookings();
}

function selectAllBookings() {
  const rows = document.querySelectorAll('.booking-row[data-id]');
  rows.forEach(r => _selectedIds.add(r.dataset.id));
  const countEl = document.getElementById('bulkSelectedCount');
  if (countEl) countEl.textContent = `${_selectedIds.size} נבחרו`;
  filterBookings();
}

function bulkWhatsApp() {
  if (_selectedIds.size === 0) { Toast.warning('לא נבחרו הזמנות'); return; }
  const selected = allBookings.filter(b => _selectedIds.has(b.id) && b.phone);
  if (selected.length === 0) { Toast.warning('אין מספרי טלפון להשלחה'); return; }
  // Open first — browser may block pop-ups for multiple
  Toast.info(`פותח ${selected.length} שיחות WhatsApp…`);
  selected.forEach((b, i) => {
    setTimeout(() => {
      const msg = WA_TEMPLATES.deposit(b);
      window.open(`https://wa.me/${formatPhoneForWhatsApp(b.phone)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    }, i * 600);
  });
}

function bulkExportSelected() {
  if (_selectedIds.size === 0) { Toast.warning('לא נבחרו הזמנות'); return; }
  const orig = [...allBookings];
  const temp = allBookings.filter(b => _selectedIds.has(b.id));
  // Temporarily override for export
  const BOM = '\uFEFF';
  const cols = ['מספר הזמנה','שם','טלפון','סוג טיפול','תאריך','שעה','מחיר','תשלום','סטטוס'];
  const rows = temp.map(b => [b.orderNumber??'',b.fullName??'',b.phone??'',bookingServiceLabel(b),b.dateKey??'',bookingHoursText(b),bookingPrice(b),b.depositPaid?'כן':'לא',STATUS_LABELS[b.effectiveStatus]??'']);
  const csv  = BOM + [cols,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=`נבחרות_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
  Toast.success(`${temp.length} הזמנות יוצאו`);
}


// ── ADD EVENT ────────────────────────────────────────────────
function serviceChoiceHTML(checkboxName, selectedIds = []) {
  return SERVICE_CATALOG.map(service => `
    <label class="admin-service-choice">
      <input type="checkbox" name="${checkboxName}" value="${service.id}" ${selectedIds.includes(service.id) ? 'checked' : ''}>
      <span><strong>${service.name}</strong><small>${formatDuration(service.duration)} · ₪${service.price.toLocaleString('he-IL')}</small></span>
    </label>
  `).join('');
}

function renderServiceChoices(containerId, checkboxName, selectedIds = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = serviceChoiceHTML(checkboxName, uniqueServiceIds(selectedIds));
  container.querySelectorAll(`input[name="${checkboxName}"]`).forEach(input => {
    input.addEventListener('change', () => {
      syncServiceChoiceClasses(checkboxName);
      if (checkboxName === 'eventServiceIds') updateAdminTreatmentFields('event');
      if (checkboxName === 'editServiceIds') updateAdminTreatmentFields('edit', _currentEditId);
    });
  });
  syncServiceChoiceClasses(checkboxName);
}

function syncServiceChoiceClasses(checkboxName) {
  document.querySelectorAll(`input[name="${checkboxName}"]`).forEach(input => {
    input.closest('.admin-service-choice')?.classList.toggle('selected', input.checked);
  });
}

function selectedServiceIdsByName(checkboxName) {
  return uniqueServiceIds([...document.querySelectorAll(`input[name="${checkboxName}"]:checked`)].map(input => input.value));
}

function setSelectedServiceIdsByName(checkboxName, ids) {
  const unique = uniqueServiceIds(ids);
  document.querySelectorAll(`input[name="${checkboxName}"]`).forEach(input => {
    input.checked = unique.includes(input.value);
  });
  syncServiceChoiceClasses(checkboxName);
}

function availableSlotsForDate(dateKey, duration, ignoreId = '') {
  if (!dateKey || !duration) return [];
  const date = new Date(dateKey + 'T00:00:00');
  const hours = workingHoursForDow(date.getDay());
  if (!hours) return [];
  const slots = [];
  for (let start = hours.start; start + duration <= hours.end; start += SLOT_STEP_MINUTES) {
    const end = start + duration;
    const hasOverlap = allBookings.some(b => bookingOverlaps(b, dateKey, start, end, ignoreId));
    if (!hasOverlap) slots.push(minutesToSlot(start));
  }
  return slots;
}

function populateSlotSelect(selectEl, dateKey, duration, selectedSlot = '', ignoreId = '') {
  if (!selectEl) return;
  const slots = availableSlotsForDate(dateKey, duration, ignoreId);
  selectEl.innerHTML = '<option value="">בחרי שעה</option>';
  slots.forEach(slot => {
    const meta = buildSlotMeta(slotToMinutes(slot), duration);
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = `${meta.text} (${meta.hours})`;
    selectEl.appendChild(opt);
  });
  if (selectedSlot && !slots.includes(selectedSlot)) {
    const start = slotToMinutes(selectedSlot);
    if (Number.isInteger(start)) {
      const opt = document.createElement('option');
      opt.value = selectedSlot;
      opt.textContent = `${minutesToTime(start)} (השעה הנוכחית)`;
      selectEl.appendChild(opt);
    }
  }
  if (selectedSlot) selectEl.value = selectedSlot;
}

function updateAdminTreatmentFields(prefix, ignoreId = '') {
  const checkboxName = prefix === 'edit' ? 'editServiceIds' : 'eventServiceIds';
  const ids = selectedServiceIdsByName(checkboxName);
  const totals = serviceTotals(ids);
  const names = serviceNamesFromIds(ids);
  const hidden = document.getElementById(prefix === 'edit' ? 'editEventType' : 'eventType');
  const priceEl = document.getElementById(prefix === 'edit' ? 'editPrice' : 'eventPrice');
  const breakdown = document.getElementById(prefix === 'edit' ? 'editPriceBreakdown' : 'priceBreakdown');
  const dateEl = document.getElementById(prefix === 'edit' ? 'editDate' : 'eventDate');
  const slotEl = document.getElementById(prefix === 'edit' ? 'editSlot' : 'eventSlot');
  if (hidden) hidden.value = names.join(', ');
  if (priceEl) priceEl.value = totals.price || '';
  if (breakdown) {
    breakdown.textContent = ids.length
      ? `${names.join(' + ')} · ${formatDuration(totals.duration)} · ₪${totals.price.toLocaleString('he-IL')}`
      : 'בחרי סוג טיפול';
  }
  populateSlotSelect(slotEl, dateEl?.value || '', totals.duration, slotEl?.value || '', ignoreId);
  if (prefix === 'event') checkSlotAvailability();
}

function openAddEventModal() {
  _resetAddEventForm();
  renderServiceChoices('eventServiceGrid', 'eventServiceIds');
  updateAdminTreatmentFields('event');
  document.getElementById('addEventModal').style.display = 'flex';
}

function openAddEventWithDate(dateKey, slot) {
  _resetAddEventForm();
  renderServiceChoices('eventServiceGrid', 'eventServiceIds');
  document.getElementById('eventDate').value = dateKey;
  setTimeout(() => {
    updateAdminTreatmentFields('event');
    document.getElementById('eventSlot').value = slot || '';
  }, 50);
  checkSlotAvailability();
  document.getElementById('addEventModal').style.display = 'flex';
}

function closeAddEventModal() {
  document.getElementById('addEventModal').style.display = 'none';
  _resetAddEventForm();
}

function _resetAddEventForm() {
  document.getElementById('addEventForm')?.reset();
  const msg = document.getElementById('slotAvailabilityMsg');
  if (msg) msg.style.display = 'none';
  const priceEl = document.getElementById('eventPrice');
  if (priceEl) priceEl.value = '';
  const bd = document.getElementById('priceBreakdown');
  if (bd) bd.textContent = 'בחרי סוג טיפול';
  renderServiceChoices('eventServiceGrid', 'eventServiceIds');
  populateSlotSelect(document.getElementById('eventSlot'), '', 0);
  _manualReceiptFile = null;
  _manualReceiptCompressed = '';
  const uploadInput = document.getElementById('eventReceiptUpload');
  if (uploadInput) uploadInput.value = '';
  const preview = document.getElementById('eventReceiptPreview');
  if (preview) preview.style.display = 'none';
  const previewImg = document.getElementById('eventReceiptPreviewImg');
  if (previewImg) previewImg.src = '';
  const fileName = document.getElementById('eventReceiptFileName');
  if (fileName) fileName.textContent = '';
}

async function handleManualReceiptUpload(evt) {
  const file = evt?.target?.files?.[0];
  if (!file) return;

  if (!MANUAL_RECEIPT_ALLOWED_TYPES.includes(file.type)) {
    Toast.error('ניתן להעלות תמונות בלבד (JPG, PNG, GIF, WebP)');
    evt.target.value = '';
    return;
  }

  if (file.size > MANUAL_RECEIPT_MAX_MB * 1024 * 1024) {
    Toast.error(`הקובץ גדול מדי — מקסימום ${MANUAL_RECEIPT_MAX_MB}MB`);
    evt.target.value = '';
    return;
  }

  try {
    const originalBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.onload = ({ target: { result } }) => resolve(result);
      reader.readAsDataURL(file);
    });

    const compressed = await compressImageForFirestore(file);
    _manualReceiptFile = file;
    _manualReceiptCompressed = compressed;

    const preview = document.getElementById('eventReceiptPreview');
    const previewImg = document.getElementById('eventReceiptPreviewImg');
    const fileName = document.getElementById('eventReceiptFileName');
    if (preview) preview.style.display = 'flex';
    if (previewImg) previewImg.src = originalBase64;
    if (fileName) fileName.textContent = file.name;

    Logger.success(`Manual receipt ready: ${Math.round(compressed.length / 1024)}KB`);
  } catch (err) {
    Logger.error('handleManualReceiptUpload failed', err);
    Toast.error('שגיאה בעיבוד התמונה, נסו שוב');
  }
}


// ── PRICE CALC ───────────────────────────────────────────────
function calculatePrice() {
  updateAdminTreatmentFields('event');
}


// ── SLOT AVAILABILITY ────────────────────────────────────────
function checkSlotAvailability() {
  const dateKey = document.getElementById('eventDate')?.value ?? '';
  const slot    = document.getElementById('eventSlot')?.value ?? '';
  const msgEl   = document.getElementById('slotAvailabilityMsg');
  if (!msgEl) return;
  if (!dateKey || !slot) { msgEl.style.display = 'none'; return; }

  const date = new Date(dateKey + 'T00:00:00');
  const dow  = date.getDay();
  const serviceIds = selectedServiceIdsByName('eventServiceIds');
  const duration = serviceTotals(serviceIds).duration;
  const start = slotToMinutes(slot);
  const end = start + duration;
  const rules = [
    [!isValidSlot(slot), '❌ שעה לא תקינה'],
    [serviceIds.length === 0, '❌ יש לבחור לפחות טיפול אחד'],
    [!isBookableDow(dow), '❌ אין קבלת תורים ביום הזה'],
    [end > (workingHoursForDow(dow)?.end || 0), '❌ התור חורג משעת הסגירה'],
  ];
  for (const [cond, msg] of rules) { if (cond) { _setAvailMsg(msgEl, msg, false); return; } }

  const taken = allBookings.find(b => bookingOverlaps(b, dateKey, start, end));
  taken
    ? _setAvailMsg(msgEl, `❌ הטווח חופף לתור של ${_esc(taken.fullName ?? '')}`, false)
    : _setAvailMsg(msgEl, `✅ הטווח פנוי (${minutesToTime(start)}-${minutesToTime(end)})`, true);
}

function _setAvailMsg(el, text, available) {
  el.style.display = 'block';
  el.className     = `availability-msg ${available ? 'available' : 'unavailable'}`;
  el.textContent   = text;
}


// ── SUBMIT NEW EVENT ─────────────────────────────────────────
async function submitNewEvent() {
  if (_isSubmitting) { Toast.warning('בתהליך שמירה…'); return; }

  const fullName  = document.getElementById('eventFullName')?.value.trim() ?? '';
  const phoneRaw  = document.getElementById('eventPhone')?.value.trim()    ?? '';
  const phone     = normalizePhoneForFirestore(phoneRaw);
  const serviceIds = selectedServiceIdsByName('eventServiceIds');
  const services = serviceSnapshotFromIds(serviceIds);
  const totals = serviceTotals(serviceIds);
  const eventType = serviceNamesFromIds(serviceIds).join(', ');
  const resident  = document.getElementById('eventResident')?.value        ?? '';
  const dateKey   = document.getElementById('eventDate')?.value            ?? '';
  const slot      = document.getElementById('eventSlot')?.value            ?? '';
  const notes     = document.getElementById('eventNotes')?.value.trim()    ?? '';
  const receiptImage = _manualReceiptCompressed || '';
  const startMinutes = slotToMinutes(slot);
  const endMinutes = startMinutes + totals.duration;

  const validations = [
    [!fullName,  'נא להזין שם מלא'],
    [!phone,     'נא להזין טלפון'],
    [!/^0\d{8,9}$/.test(phone), 'טלפון לא תקין — הזינו מספר ישראלי עם 0 (למשל 0501234567)'],
    [serviceIds.length === 0, 'נא לבחור לפחות טיפול אחד'],
    [!dateKey,   'נא לבחור תאריך'],
    [!slot,      'נא לבחור שעה'],
  ];
  for (const [cond, msg] of validations) { if (cond) { Toast.warning(msg); return; } }

  const date = new Date(dateKey + 'T00:00:00');
  const dow  = date.getDay();
  const dowRules = [
    [!isValidSlot(slot),              '❌ שעה לא תקינה'],
    [!isBookableDow(dow),            '❌ אין קבלת תורים ביום הזה'],
    [endMinutes > (workingHoursForDow(dow)?.end || 0), '❌ התור חורג משעת הסגירה'],
  ];
  for (const [cond, msg] of dowRules) { if (cond) { Toast.warning(msg); return; } }

  const existing = allBookings.find(b => bookingOverlaps(b, dateKey, startMinutes, endMinutes));
  if (existing) { Toast.error(`הטווח חופף לתור של ${existing.fullName ?? ''}`); return; }

  const orderNumber = _generateOrderNumber();
  // זהות שדות מול validAdminCreate ב-Firestore (hasOnly) — ללא קבלה/כפילות שדות
  const bookingData = {
    orderNumber, fullName, phone, eventType,
    serviceIds,
    services,
    totalDuration: totals.duration,
    residentText: resident,
    dateKey,
    gregDate:    formatGregDate(dateKey),
    hebrewDate:  '',
    slot,
    slotText:    minutesToTime(startMinutes),
    hoursText:   `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`,
    startMinutes,
    endMinutes,
    endTimeText: minutesToTime(endMinutes),
    lockSlots: lockSlotsForRange(startMinutes, endMinutes),
    projector: false,
    price: totals.price,
    notes,
    depositPaid: false,
    status:      'approved',
    source:      'admin-manual',
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };

  _isSubmitting = true;
  const submitBtn = document.querySelector('#addEventModal .btn-approve');
  if (submitBtn) { submitBtn.textContent = '⏳ שומר...'; submitBtn.disabled = true; }

  try {
    const lockDocs = buildSlotLocks(dateKey, slot, orderNumber, startMinutes, endMinutes);
    const probeRefs = lockProbeSlotsForRange(startMinutes, endMinutes)
      .map(lockSlot => _slotRef(dateKey, lockSlot));
    const bookingRef = db.collection('bookings').doc(orderNumber);

    // Atomic: claim the slot lock and create the booking together.
    await withRetry(() => db.runTransaction(async (tx) => {
      for (const ref of probeRefs) {
        const slotSnap = await tx.get(ref);
        if (slotSnap.exists) throw new Error('SLOT_TAKEN');
      }
      const bookingSnap = await tx.get(bookingRef);
      if (bookingSnap.exists) throw new Error('ORDER_COLLISION');
      tx.set(bookingRef, bookingData);
      lockDocs.forEach(lock => {
        tx.set(_slotRef(dateKey, lock.slot), lock.data);
      });
    }));

    if (receiptImage) {
      await withRetry(() =>
        bookingRef.update({
          hasReceipt: true,
          receipt_image: receiptImage,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
      );
    }
    closeAddEventModal();
    Toast.success(`התור נוסף! מספר הזמנה: ${orderNumber}`);
  } catch(err) {
    Logger.error('submitNewEvent', err);
    Toast.error(err?.message === 'SLOT_TAKEN'
      ? 'השעה נתפסה זה עתה — רעננו ובדקו זמינות'
      : err?.message === 'ORDER_COLLISION'
        ? 'נוצרה התנגשות במספר ההזמנה — נסי להוסיף שוב'
        : 'שגיאה בהוספת התור');
  } finally {
    _isSubmitting = false;
    if (submitBtn) { submitBtn.textContent = '✅ הוסף תור'; submitBtn.disabled = false; }
  }
}


// ── HELPERS ──────────────────────────────────────────────────
function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function formatGregDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `יום ${DAY_NAMES[date.getDay()]}, ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

function isValidSlot(slot) {
  return SLOT_KEYS.includes(slot);
}

function isBookableDow(dow) {
  return !!workingHoursForDow(dow);
}

function _generateOrderNumber() {
  const now  = new Date();
  const yy   = now.getFullYear().toString().slice(-2);
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const rand = _strongOrderSuffix();
  return `MN-${yy}${mm}${dd}-${rand}`;
}

function _strongOrderSuffix() {
  try {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  } catch (_) {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2))
      .slice(-8)
      .toUpperCase();
  }
}

function _debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}


// ── SLOT LOCKS (booked_slots) ────────────────────────────────
// booked_slots/{dateKey}_{slot} mirrors active reservations WITHOUT any PII,
// so the public site can read availability without access to `bookings`.
// Every admin write path that affects a slot must keep this collection in sync.
function _slotRef(dateKey, slot) {
  return db.collection('booked_slots').doc(`${dateKey}_${slot}`);
}

/**
 * One-time backfill: ensure every ACTIVE booking has a matching slot lock.
 * Run once from the browser console after deploying (idempotent — safe to repeat).
 * @returns {Promise<number>} number of locks created
 */
async function backfillSlotLocks() {
  const active = allBookings.filter(b => b.status !== 'cancelled' && b.dateKey && b.slot);
  let created = 0;
  for (const b of active) {
    const ref = _slotRef(b.dateKey, b.slot);
    try {
      const didCreate = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.set(ref, {
          dateKey:     b.dateKey,
          slot:        b.slot,
          orderNumber: b.orderNumber ?? '',
          createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (didCreate) created++;
    } catch (e) {
      Logger.error(`backfillSlotLocks: failed for ${b.dateKey}_${b.slot}`, e);
    }
  }
  Logger.success(`backfillSlotLocks: created ${created} lock(s)`);
  Toast.success(`גובו ${created} מנעולי משבצת`);
  return created;
}


// ── KEYBOARD SHORTCUTS ───────────────────────────────────────
function _handleKeyboardShortcuts(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'n' || e.key === 'N') { openAddEventModal(); }
  if (e.key === '/')  { e.preventDefault(); document.getElementById('searchInput')?.focus(); }
  if (e.key === 'c' || e.key === 'C') { switchTab('calendar'); }
  if (e.key === 'b' || e.key === 'B') { switchTab('bookings'); }
  if (e.key === 'a' || e.key === 'A') { switchTab('analytics'); }
  if (e.key === 'e' || e.key === 'E') { exportCSV(); }
}

function showKeyboardShortcuts() {
  const shortcuts = [
    ['N', 'תור חדש'], ['/', 'חיפוש'], ['C', 'לוח שנה'],
    ['B', 'הזמנות'], ['A', 'ניתוח'], ['E', 'ייצוא CSV'],
    ['Esc', 'סגור מודל'],
  ];
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-card" style="max-width:400px">
      <h3>⌨️ קיצורי מקלדת</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin:16px 0;text-align:right">
        ${shortcuts.map(([k,v]) => `
          <div style="display:flex;align-items:center;gap:8px;justify-content:flex-start">
            <kbd style="background:rgba(201,165,76,.15);border:1px solid var(--border-gold);border-radius:6px;padding:3px 8px;font-family:monospace;font-size:13px;color:var(--gold);font-weight:700">${k}</kbd>
            <span style="font-size:13px;color:var(--text-secondary)">${v}</span>
          </div>`).join('')}
      </div>
      <div class="confirm-actions">
        <button class="btn btn-approve" onclick="this.closest('.confirm-overlay').remove()">הבנתי</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}


// ── DOM CONTENT LOADED ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Firebase Auth drives login/panel visibility (replaces the old client-side password gate)
  auth.onAuthStateChanged(_onAuthStateChanged);

  // Enter submits the login form from either field
  ['adminEmail', 'adminPassword'].forEach(id =>
    document.getElementById(id)
      ?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); })
  );

  // Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal(); closeAddEventModal(); closeEditModal(); closeWaModal(); closeNoteModal();
      document.getElementById('notificationsSidebar')?.classList.remove('open');
    }
    _handleKeyboardShortcuts(e);
  });

  // Click outside to close notifications sidebar
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('notificationsSidebar');
    const btn     = document.querySelector('.btn-notifications');
    if (sidebar?.classList.contains('open') &&
        !sidebar.contains(e.target) && e.target !== btn &&
        !btn?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Pricing & availability auto-calc
  ['eventDate','eventSlot'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', () => {
      checkSlotAvailability(); calculatePrice();
    })
  );
  document.getElementById('eventResident') ?.addEventListener('change', calculatePrice);
  document.getElementById('eventProjector')?.addEventListener('change', calculatePrice);
  document.getElementById('eventType')     ?.addEventListener('change', calculatePrice);
  document.getElementById('eventReceiptUpload')?.addEventListener('change', handleManualReceiptUpload);

  // Live search + filters debounce
  document.getElementById('searchInput')       ?.addEventListener('input', _debounce(filterBookings, 200));
  document.getElementById('eventTypeFilter')   ?.addEventListener('change', filterBookings);
  document.getElementById('dateFromFilter')    ?.addEventListener('change', filterBookings);
  document.getElementById('dateToFilter')      ?.addEventListener('change', filterBookings);
  document.getElementById('statusFilter')      ?.addEventListener('change', filterBookings);
});
