'use strict';

/* ================= Constants ================= */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CATS = ['COLLEGE', 'DESIGN', 'PERSONAL', 'HOUSE', 'FITNESS'];
const PRESETS = [
  { id: 'p1', name: 'Exercise', category: 'FITNESS' },
  { id: 'p2', name: 'Read books', category: 'PERSONAL' },
  { id: 'p3', name: 'Meditate', category: 'PERSONAL' },
  { id: 'p4', name: 'Plan meals', category: 'HOUSE' },
  { id: 'p5', name: 'Water plants', category: 'HOUSE' },
  { id: 'p6', name: 'Journal', category: 'PERSONAL' },
  { id: 'p7', name: 'Stretch for 15 mins', category: 'FITNESS' },
  { id: 'p8', name: 'Review goals', category: 'PERSONAL' },
  { id: 'p9', name: 'DBMS Lecture', category: 'COLLEGE' },
  { id: 'p10', name: 'Web Dev Lab', category: 'COLLEGE' }
];
const STORE = { tasks: 'habitual_templates', done: 'habitual_completions' };

/* ================= Helpers ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));

const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayName = d => DAYS[(d.getDay() + 6) % 7]; // Monday-first

function fmtTime(v) {
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
const whenText = t => t.start ? ` ${fmtTime(t.start)}${t.end ? ' – ' + fmtTime(t.end) : ''}` : '';
const byTime = (a, b) => (a.start || '99:99').localeCompare(b.start || '99:99');

/* ================= Storage ================= */
function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
}
function save() {
  try {
    localStorage.setItem(STORE.tasks, JSON.stringify(tasks));
    localStorage.setItem(STORE.done, JSON.stringify(done));
  } catch { /* storage full or blocked: app keeps working in memory */ }
}

// Old versions stored free-text times ("09:00 AM - 10:30 AM") and `repeatDays`.
function to24(m) {
  let h = Number(m[1]);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${pad(h)}:${m[2]}`;
}
function migrate(t) {
  if (t.days) return { ...t, id: String(t.id) };
  const times = [...String(t.time || '').matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)?/gi)].map(to24);
  return { id: String(t.id), title: t.title, category: t.category, start: times[0] || '', end: times[1] || '', days: t.repeatDays || [] };
}
const seed = () => [
  { title: 'DBMS Lecture', category: 'COLLEGE', start: '09:00', end: '10:30', days: ['Mon', 'Thu', 'Fri'] },
  { title: 'Web Development Lab', category: 'COLLEGE', start: '11:00', end: '13:00', days: ['Thu', 'Fri'] },
  { title: 'Stretch for 15 minutes', category: 'PERSONAL', start: '08:00', end: '', days: [...DAYS] },
  { title: 'Plan your meal', category: 'PERSONAL', start: '', end: '', days: [...DAYS] },
  { title: 'Review daily goals before sleeping', category: 'PERSONAL', start: '22:00', end: '', days: [...DAYS] },
  { title: 'Water indoor plants', category: 'HOUSE', start: '', end: '', days: ['Thu', 'Sun'] }
].map(t => ({ id: uid(), ...t }));

/* ================= State ================= */
const stored = load(STORE.tasks, null);
let tasks = stored ? stored.map(migrate) : seed();
// Completion keys are "YYYY-MM-DD|taskId"; old "26-1" style keys are dropped.
let done = Object.fromEntries(Object.entries(load(STORE.done, {})).filter(([k]) => /^\d{4}-/.test(k)));
const S = { tab: 'today', date: toISO(new Date()), cat: 'ALL', ttDay: 'ALL', picks: new Set() };
let editingId = null, lastDeleted = null, toastTimer = 0;

/* ================= Queries ================= */
const isDone = (ds, id) => !!done[`${ds}|${id}`];
const isRecurring = t => !t.date;

function tasksOn(ds) {
  const name = dayName(fromISO(ds));
  return tasks.filter(t => (t.date ? t.date === ds : t.days.includes(name)));
}

// Consecutive scheduled days completed, counting back from `ds`.
// An unfinished `ds` itself doesn't break the streak.
function streak(t, ds) {
  if (!isRecurring(t)) return 0;
  let count = 0;
  let d = fromISO(ds);
  for (let i = 0; i < 366; i++) {
    if (t.days.includes(dayName(d))) {
      if (isDone(toISO(d), t.id)) count++;
      else if (i > 0) break;
    }
    d = addDays(d, -1);
  }
  return count;
}

/* ================= Rendering ================= */
function render() {
  renderToday();
  renderTimetable();
  renderPicker();
  $('#badgeToday').textContent = tasksOn(S.date).length;
  $('#badgeAll').textContent = tasks.filter(isRecurring).length;
}

function renderToday() {
  const date = fromISO(S.date);
  const todayISO = toISO(new Date());
  $('#todayTitle').textContent = S.date === todayISO ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'long' });
  $('#dateText').textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Week strip (Monday-first)
  const monday = addDays(date, -((date.getDay() + 6) % 7));
  let strip = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i), ds = toISO(d);
    strip += `<button class="day-btn${ds === todayISO ? ' today' : ''}" data-date="${ds}" aria-pressed="${ds === S.date}"
      aria-label="${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}">
      <small>${DAYS[i]}</small><strong>${d.getDate()}</strong></button>`;
  }
  $('#strip').innerHTML = strip;

  // Progress (all categories for the selected date)
  const all = tasksOn(S.date);
  const finished = all.filter(t => isDone(S.date, t.id)).length;
  const pct = all.length ? Math.round(finished / all.length * 100) : 0;
  $('#pct').textContent = pct + '%';
  $('#fill').style.width = pct + '%';
  $('#fill').parentElement.setAttribute('aria-valuenow', pct);
  $('#pctText').textContent = `${finished} of ${all.length} tasks done`;

  // Category filter chips
  $('#filters').innerHTML = ['ALL', ...CATS].map(c =>
    `<button class="chip" data-cat="${c}" aria-pressed="${S.cat === c}">${c}</button>`).join('');

  // Task groups
  const list = all.filter(t => S.cat === 'ALL' || t.category === S.cat);
  if (!list.length) {
    $('#tasks').innerHTML = `<div class="empty"><b>Nothing scheduled ✨</b>Use the bar below to add a task for this day.</div>`;
    return;
  }
  $('#tasks').innerHTML = CATS.map(cat => {
    const items = list.filter(t => t.category === cat).sort(byTime);
    if (!items.length) return '';
    return `<section class="group"><h3>${cat}</h3>${items.map(taskCard).join('')}</section>`;
  }).join('');
}

function taskCard(t) {
  const ok = isDone(S.date, t.id), s = streak(t, S.date);
  return `<div class="task${ok ? ' done' : ''}">
    <label>
      <input type="checkbox" class="chk" data-id="${t.id}"${ok ? ' checked' : ''}>
      <span>
        <span class="tt">${esc(t.title)}</span>
        ${t.start ? `<small>${whenText(t)}</small>` : ''}
        ${s > 1 ? `<small class="streak">🔥 ${s}-day streak</small>` : ''}
      </span>
    </label>
    ${isRecurring(t) ? `<button class="ib" data-edit="${t.id}" aria-label="Edit ${esc(t.title)}">✎</button>` : ''}
    <button class="ib" data-del="${t.id}" aria-label="Delete ${esc(t.title)}${isRecurring(t) ? ' (all days)' : ''}">✕</button>
  </div>`;
}

function renderTimetable() {
  $('#ttDays').innerHTML = ['ALL', ...DAYS].map(d =>
    `<button class="chip" data-ttday="${d}" aria-pressed="${S.ttDay === d}">${d === 'ALL' ? 'All days' : d}</button>`).join('');

  const list = tasks.filter(t => isRecurring(t) && (S.ttDay === 'ALL' || t.days.includes(S.ttDay))).sort(byTime);
  if (!list.length) {
    $('#ttList').innerHTML = `<div class="empty"><b>No schedule here yet</b>Tap “＋ Add” to set up your week.</div>`;
    return;
  }
  $('#ttList').innerHTML = list.map(t => `
    <div class="task"><div style="flex:1;padding:8px 0">
      <div><span class="tag">${t.category}</span><small style="color:var(--green);font-weight:700">${whenText(t)}</small></div>
      <div class="tt" style="margin-top:4px">${esc(t.title)}</div>
      <div class="dayrow">${DAYS.map(d => `<span class="${t.days.includes(d) ? 'on' : ''}">${d[0]}</span>`).join('')}</div>
    </div>
    <button class="ib" data-edit="${t.id}" aria-label="Edit ${esc(t.title)}">✎</button>
    <button class="ib" data-del="${t.id}" aria-label="Delete ${esc(t.title)}">✕</button></div>`).join('');
}

function renderPicker() {
  $('#pills').innerHTML = PRESETS.map(p =>
    `<button class="pill" data-pick="${p.id}" aria-pressed="${S.picks.has(p.id)}">${esc(p.name)}</button>`).join('');
}

/* ================= Actions ================= */
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.tab').forEach(b => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== `view-${tab}`; });
}

function toast(msg, withUndo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${withUndo ? '<button data-undo>Undo</button>' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; lastDeleted = null; }, 5000);
}

function deleteTask(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index < 0) return;
  lastDeleted = { task: tasks[index], index };
  tasks.splice(index, 1);
  save(); render();
  toast(`Deleted “${lastDeleted.task.title}”`, true);
}

function undoDelete() {
  if (!lastDeleted) return;
  tasks.splice(lastDeleted.index, 0, lastDeleted.task);
  lastDeleted = null;
  $('#toast').hidden = true;
  save(); render();
}

function addPicked() {
  let added = 0;
  for (const p of PRESETS) {
    if (!S.picks.has(p.id)) continue;
    if (tasks.some(t => isRecurring(t) && t.title.toLowerCase() === p.name.toLowerCase())) continue;
    tasks.push({ id: uid(), title: p.name, category: p.category, start: '', end: '', days: [...DAYS] });
    added++;
  }
  S.picks.clear();
  save(); setTab('today'); render();
  toast(added ? `Added ${added} habit${added > 1 ? 's' : ''}` : 'Those habits are already in your schedule');
}

/* ================= Dialog ================= */
const dlg = $('#dlg'), form = $('#taskForm');

function buildDialogControls() {
  $('#fCat').innerHTML = CATS.map(c => `<option>${c}</option>`).join('');
  $('#quickCat').innerHTML = ['PERSONAL', ...CATS.filter(c => c !== 'PERSONAL')].map(c => `<option>${c}</option>`).join('');
  $('#fDays').innerHTML = DAYS.map(d =>
    `<label class="day"><input type="checkbox" value="${d}" aria-label="${d}"><span>${d[0]}</span></label>`).join('');
}

function setDays(list) {
  document.querySelectorAll('#fDays input').forEach(i => { i.checked = list.includes(i.value); });
}

function openDialog(task) {
  editingId = task ? task.id : null;
  $('#dlgTitle').textContent = task ? 'Edit recurring task' : 'Add recurring task';
  $('#fName').value = task ? task.title : '';
  $('#fCat').value = task ? task.category : 'COLLEGE';
  $('#fStart').value = task ? task.start : '';
  $('#fEnd').value = task ? task.end : '';
  setDays(task ? task.days : []);
  $('#formError').hidden = true;
  dlg.showModal();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const days = [...document.querySelectorAll('#fDays input:checked')].map(i => i.value);
  if (!days.length) { $('#formError').hidden = false; return; }
  const data = { title: $('#fName').value.trim(), category: $('#fCat').value, start: $('#fStart').value, end: $('#fEnd').value, days };
  if (editingId) {
    const t = tasks.find(x => x.id === editingId);
    if (t) Object.assign(t, data);
  } else {
    tasks.push({ id: uid(), ...data });
  }
  save(); dlg.close(); render();
});

$('#dlgClose').addEventListener('click', () => dlg.close());
$('#dlgCancel').addEventListener('click', () => dlg.close());

// Light-dismiss fallback for browsers without <dialog closedby> (Safari)
if (!('closedBy' in HTMLDialogElement.prototype)) {
  dlg.addEventListener('click', e => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
    if (!inside) dlg.close();
  });
}

/* ================= Events (delegated) ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('button');
  if (!el) return;
  const d = el.dataset;

  if (d.tab) { setTab(d.tab); render(); }
  else if (d.date) { S.date = d.date; render(); }
  else if ('shift' in d) { S.date = toISO(addDays(fromISO(S.date), Number(d.shift))); render(); }
  else if ('gotoToday' in d) { S.date = toISO(new Date()); render(); }
  else if (d.cat) { S.cat = d.cat; render(); }
  else if (d.ttday) { S.ttDay = d.ttday; render(); }
  else if (d.pick) { S.picks.has(d.pick) ? S.picks.delete(d.pick) : S.picks.add(d.pick); renderPicker(); }
  else if ('confirmPicks' in d) addPicked();
  else if ('openAdd' in d) openDialog(null);
  else if (d.edit) openDialog(tasks.find(t => t.id === d.edit));
  else if (d.del) deleteTask(d.del);
  else if ('undo' in d) undoDelete();
  else if (d.preset) setDays(d.preset === 'all' ? DAYS : d.preset === 'weekdays' ? DAYS.slice(0, 5) : []);
});

document.addEventListener('change', e => {
  if (!e.target.classList.contains('chk')) return;
  const key = `${S.date}|${e.target.dataset.id}`;
  if (e.target.checked) done[key] = true; else delete done[key];
  save(); render();
});

$('#quickForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#quickInput'), title = input.value.trim();
  if (!title) return;
  // One-off task: belongs to the selected date only (no accidental weekly repeat).
  tasks.push({ id: uid(), title, category: $('#quickCat').value, start: '', end: '', days: [], date: S.date });
  input.value = '';
  save(); render();
});

/* ================= Init ================= */
buildDialogControls();
setTab('today');
render();
