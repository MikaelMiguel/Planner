/**
 * ================================================================
 * PLANNER DO PROFESSOR — app.js  (v2 — Turmas Recorrentes)
 * Organização: Estado → Storage → Utilitários → CRUD →
 *              Recorrência → Calendário → Modais → Eventos → Init
 * ================================================================
 */

'use strict';

/* ──────────────────────────────────────────────────────────────
   1. ESTADO DA APLICAÇÃO
   ────────────────────────────────────────────────────────────── */

/**
 * Estado global.
 * @property {number}      year          - Ano exibido no calendário
 * @property {number}      month         - Mês exibido (0=Jan…11=Dez)
 * @property {string|null} selectedDate  - Data aberta no modal "YYYY-MM-DD"
 * @property {Object}      lessons       - Aulas avulsas { "YYYY-MM-DD": [{id,time,name,school,notes}] }
 * @property {Array}       classes       - Turmas recorrentes [{id,name,level,school,time,days[],notes}]
 */
const state = {
  year:         new Date().getFullYear(),
  month:        new Date().getMonth(),
  selectedDate: null,
  lessons:      {},   // aulas avulsas — compatível com v1
  classes:      []    // turmas recorrentes — NOVO em v2
};

/** Data de hoje como "YYYY-MM-DD" */
const TODAY = toDateKey(new Date());

/* ──────────────────────────────────────────────────────────────
   2. UTILITÁRIOS
   ────────────────────────────────────────────────────────────── */

/** Converte Date → "YYYY-MM-DD" */
function toDateKey(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Gera ID único simples */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Formata "YYYY-MM-DD" → texto longo ex: "quarta-feira, 14 de maio de 2025" */
function formatDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/** Primeiro dia (domingo) da semana que contém date */
function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Último dia (sábado) da semana que contém date */
function getWeekEnd(date) {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
  return d;
}

/** Nomes curtos dos dias da semana (índice 0 = Dom) */
const WEEKDAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

/** Nomes dos meses em pt-BR */
const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

/** Escapa string para innerHTML seguro */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ──────────────────────────────────────────────────────────────
   3. PERSISTÊNCIA — localStorage
   Duas chaves separadas para compatibilidade retroativa:
   - STORAGE_LESSONS: aulas avulsas (mesma chave da v1)
   - STORAGE_CLASSES: turmas recorrentes (nova em v2)
   ────────────────────────────────────────────────────────────── */
const STORAGE_LESSONS = 'teacher-planner-v1';
const STORAGE_CLASSES = 'teacher-planner-classes-v1';

function loadFromStorage() {
  try {
    const rawLessons = localStorage.getItem(STORAGE_LESSONS);
    if (rawLessons) state.lessons = JSON.parse(rawLessons);

    const rawClasses = localStorage.getItem(STORAGE_CLASSES);
    if (rawClasses) state.classes = JSON.parse(rawClasses);
  } catch (e) {
    console.warn('Erro ao carregar dados:', e);
  }
}

function saveLessons() {
  try { localStorage.setItem(STORAGE_LESSONS, JSON.stringify(state.lessons)); }
  catch (e) { console.warn('Erro ao salvar aulas:', e); }
}

function saveClasses() {
  try { localStorage.setItem(STORAGE_CLASSES, JSON.stringify(state.classes)); }
  catch (e) { console.warn('Erro ao salvar turmas:', e); }
}

/* ──────────────────────────────────────────────────────────────
   4. CRUD — Aulas Avulsas (mantido de v1)
   ────────────────────────────────────────────────────────────── */

function getLessons(dateKey) {
  return (state.lessons[dateKey] || []).slice().sort((a, b) =>
    a.time.localeCompare(b.time)
  );
}

function addLesson(dateKey, data) {
  if (!state.lessons[dateKey]) state.lessons[dateKey] = [];
  const lesson = { id: uid(), ...data };
  state.lessons[dateKey].push(lesson);
  saveLessons();
  return lesson;
}

function updateLesson(dateKey, id, data) {
  const list = state.lessons[dateKey];
  if (!list) return false;
  const idx = list.findIndex(l => l.id === id);
  if (idx === -1) return false;
  list[idx] = { id, ...data };
  saveLessons();
  return true;
}

function removeLesson(dateKey, id) {
  if (!state.lessons[dateKey]) return;
  state.lessons[dateKey] = state.lessons[dateKey].filter(l => l.id !== id);
  if (state.lessons[dateKey].length === 0) delete state.lessons[dateKey];
  saveLessons();
}

/* ──────────────────────────────────────────────────────────────
   5. CRUD — Turmas Recorrentes (NOVO v2)
   ────────────────────────────────────────────────────────────── */

function addClass(data) {
  const cls = { id: uid(), ...data };
  state.classes.push(cls);
  saveClasses();
  return cls;
}

function updateClass(id, data) {
  const idx = state.classes.findIndex(c => c.id === id);
  if (idx === -1) return false;
  state.classes[idx] = { id, ...data };
  saveClasses();
  return true;
}

function removeClass(id) {
  state.classes = state.classes.filter(c => c.id !== id);
  saveClasses();
}

/* ──────────────────────────────────────────────────────────────
   6. RECORRÊNCIA — geração dinâmica (NOVO v2)
   Nenhum dado é salvo no localStorage: as ocorrências são
   calculadas na hora a partir das turmas cadastradas.
   ────────────────────────────────────────────────────────────── */

/**
 * Retorna as turmas que ocorrem em um dia específico.
 * @param {string} dateKey "YYYY-MM-DD"
 * @returns {Array} cópias das turmas com flag _recurring:true
 */
function getRecurringForDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekDay   = new Date(y, m - 1, d).getDay(); // 0=Dom…6=Sáb

  return state.classes
    .filter(cls => Array.isArray(cls.days) && cls.days.includes(weekDay))
    .map(cls => ({ ...cls, _recurring: true }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Conta todas as aulas de um dia (avulsas + recorrentes).
 * @param {string} dateKey
 * @returns {{ avulsas: number, recorrentes: number, total: number }}
 */
function countDayLessons(dateKey) {
  const avulsas     = getLessons(dateKey).length;
  const recorrentes = getRecurringForDate(dateKey).length;
  return { avulsas, recorrentes, total: avulsas + recorrentes };
}

/**
 * Coleta todas as ocorrências num intervalo e agrupa por
 * TURMA → dia → horário.
 * Aulas avulsas sem turma ficam no grupo '__avulsas'.
 *
 * @param {string} startKey "YYYY-MM-DD"
 * @param {string} endKey   "YYYY-MM-DD"
 * @returns {Map<string, { classInfo: Object|null, byDate: Map<string,Array> }>}
 */
function collectByClass(startKey, endKey) {
  const result = new Map();

  function ensureGroup(key, classInfo) {
    if (!result.has(key)) result.set(key, { classInfo, byDate: new Map() });
    return result.get(key);
  }

  // Percorre cada dia do intervalo
  const start = new Date(startKey.replace(/-/g, '/'));
  const end   = new Date(endKey.replace(/-/g, '/'));

  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const dateKey = toDateKey(cur);

    // Turmas recorrentes do dia
    getRecurringForDate(dateKey).forEach(cls => {
      const grp = ensureGroup(cls.id, cls);
      if (!grp.byDate.has(dateKey)) grp.byDate.set(dateKey, []);
      grp.byDate.get(dateKey).push({
        time: cls.time, name: cls.name, notes: cls.notes, _type: 'recurring'
      });
    });

    // Aulas avulsas do dia
    const avulsas = getLessons(dateKey);
    if (avulsas.length > 0) {
      const grp = ensureGroup('__avulsas', null);
      if (!grp.byDate.has(dateKey)) grp.byDate.set(dateKey, []);
      avulsas.forEach(l => grp.byDate.get(dateKey).push({ ...l, _type: 'avulsa' }));
    }
  }

  // Ordena por horário dentro de cada dia
  result.forEach(({ byDate }) => {
    byDate.forEach((items, key) => {
      byDate.set(key, [...items].sort((a, b) => a.time.localeCompare(b.time)));
    });
  });

  return result;
}

/* ──────────────────────────────────────────────────────────────
   7. CALENDÁRIO — renderização
   ────────────────────────────────────────────────────────────── */
const elMonth = document.getElementById('current-month');
const elYear  = document.getElementById('current-year');
const elGrid  = document.getElementById('calendar-grid');
const elStats = document.getElementById('calendar-stats');

function renderCalendar() {
  elMonth.textContent = MONTHS_PT[state.month];
  elYear.textContent  = state.year;
  elGrid.innerHTML    = '';

  const firstDay = new Date(state.year, state.month, 1);
  const lastDay  = new Date(state.year, state.month + 1, 0);

  const startOffset = firstDay.getDay();
  for (let i = 0; i < startOffset; i++) {
    elGrid.appendChild(createDayCell(
      new Date(state.year, state.month, 1 - (startOffset - i)), true
    ));
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    elGrid.appendChild(createDayCell(new Date(state.year, state.month, d), false));
  }

  const total     = startOffset + lastDay.getDate();
  const remaining = (7 - (total % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    elGrid.appendChild(createDayCell(new Date(state.year, state.month + 1, i), true));
  }

  renderStats();
}

function createDayCell(date, otherMonth) {
  const key       = toDateKey(date);
  const counts    = countDayLessons(key);
  const recurring = getRecurringForDate(key);
  const avulsas   = getLessons(key);
  const isToday   = key === TODAY;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const cell = document.createElement('div');
  cell.className = 'day';
  cell.setAttribute('role', 'gridcell');
  cell.setAttribute('aria-label', formatDate(key));
  cell.dataset.date = key;

  if (otherMonth)           cell.classList.add('day--other-month');
  if (isToday)              cell.classList.add('day--today');
  if (isWeekend)            cell.classList.add('day--weekend');
  if (counts.total > 0)     cell.classList.add('day--has-lessons');
  if (counts.recorrentes > 0 && counts.avulsas === 0)
                            cell.classList.add('day--has-recurring');

  // Número do dia
  const numEl = document.createElement('div');
  numEl.className = 'day__number';
  numEl.textContent = date.getDate();

  // Badge com total de aulas
  const badge = document.createElement('div');
  badge.className = 'day__badge';
  badge.textContent = counts.total;

  // Previews: recorrentes primeiro, depois avulsas
  const previews = document.createElement('div');
  previews.className = 'day__previews';
  const MAX = 2;
  let shown = 0;

  recurring.slice(0, MAX).forEach(cls => {
    if (shown >= MAX) return;
    const item = document.createElement('div');
    item.className = 'day__preview-item day__preview-item--recurring';
    item.textContent = `${cls.time} ${cls.name}`;
    previews.appendChild(item);
    shown++;
  });

  avulsas.slice(0, MAX - shown).forEach(l => {
    const item = document.createElement('div');
    item.className = 'day__preview-item';
    item.textContent = `${l.time} ${l.name}`;
    previews.appendChild(item);
    shown++;
  });

  if (counts.total - Math.min(shown, MAX) > 0) {
    const more = document.createElement('div');
    more.className = 'day__preview-more';
    more.textContent = `+${counts.total - Math.min(shown, MAX)} mais`;
    previews.appendChild(more);
  }

  cell.appendChild(numEl);
  cell.appendChild(badge);
  cell.appendChild(previews);

  if (!otherMonth) {
    cell.addEventListener('click', () => openDayModal(key));
  }

  return cell;
}

function renderStats() {
  let totalAvulsas   = 0;
  let totalRecurring = 0;
  const schools   = new Set();
  const daysSet   = new Set();

  // Avulsas no mês
  Object.entries(state.lessons).forEach(([key, lessons]) => {
    const [y, m] = key.split('-').map(Number);
    if (y === state.year && m - 1 === state.month) {
      totalAvulsas += lessons.length;
      daysSet.add(key);
      lessons.forEach(l => { if (l.school) schools.add(l.school.trim()); });
    }
  });

  // Recorrentes no mês
  const lastDay = new Date(state.year, state.month + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const key = toDateKey(new Date(state.year, state.month, d));
    const rec = getRecurringForDate(key);
    if (rec.length > 0) {
      totalRecurring += rec.length;
      daysSet.add(key);
      rec.forEach(c => { if (c.school) schools.add(c.school.trim()); });
    }
  }

  elStats.innerHTML = `
    <div class="stats__item">
      <span class="stats__label">Total de aulas</span>
      <span class="stats__value">${totalAvulsas + totalRecurring}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">Turmas fixas</span>
      <span class="stats__value">${state.classes.length}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">Dias com aula</span>
      <span class="stats__value">${daysSet.size}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">Escolas / Locais</span>
      <span class="stats__value">${schools.size}</span>
    </div>
  `;
}

/* ──────────────────────────────────────────────────────────────
   8. MODAL DO DIA
   ────────────────────────────────────────────────────────────── */
const dayOverlay     = document.getElementById('day-overlay');
const elDayTitle     = document.getElementById('modal-day-title');
const elDayLessons   = document.getElementById('day-lessons');
const elDayRecurring = document.getElementById('day-recurring');
const formSection    = document.getElementById('form-section');
const formHeading    = document.getElementById('form-heading');
const lessonForm     = document.getElementById('lesson-form');
const fTime          = document.getElementById('f-time');
const fName          = document.getElementById('f-name');
const fSchool        = document.getElementById('f-school');
const fNotes         = document.getElementById('f-notes');
const fEditId        = document.getElementById('edit-id');

function openDayModal(dateKey) {
  state.selectedDate = dateKey;
  elDayTitle.textContent = formatDate(dateKey);
  renderDayRecurring();
  renderDayLessons();
  resetLessonForm();
  dayOverlay.removeAttribute('hidden');
  requestAnimationFrame(() => dayOverlay.classList.add('is-open'));
}

function closeDayModal() {
  dayOverlay.classList.remove('is-open');
  dayOverlay.addEventListener('transitionend', () => {
    dayOverlay.setAttribute('hidden', '');
    state.selectedDate = null;
    resetLessonForm();
  }, { once: true });
}

/** Renderiza a seção de turmas recorrentes dentro do modal do dia */
function renderDayRecurring() {
  const recurring = getRecurringForDate(state.selectedDate);
  elDayRecurring.innerHTML = '';
  if (recurring.length === 0) return;

  const section = document.createElement('div');
  section.className = 'recurring-section';
  section.innerHTML = `<div class="recurring-section__title">🔁 Turmas Fixas</div>`;

  recurring.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'recurring-card';
    card.innerHTML = `
      <div class="recurring-card__time">${escapeHtml(cls.time)}</div>
      <div class="recurring-card__body">
        <div class="recurring-card__name">${escapeHtml(cls.name)}</div>
        <div class="recurring-card__meta">
          <span class="recurring-badge">Recorrente</span>
          ${cls.level  ? `<span class="tag tag--teal">${escapeHtml(cls.level)}</span>` : ''}
          ${cls.school ? `<span class="tag tag--amber">📍 ${escapeHtml(cls.school)}</span>` : ''}
        </div>
        ${cls.notes
          ? `<div class="recurring-card__notes">${escapeHtml(cls.notes)}</div>`
          : ''}
      </div>
    `;
    section.appendChild(card);
  });

  elDayRecurring.appendChild(section);
}

/** Renderiza a lista de aulas avulsas no modal do dia */
function renderDayLessons() {
  const lessons    = getLessons(state.selectedDate);
  const hasRecurring = getRecurringForDate(state.selectedDate).length > 0;
  elDayLessons.innerHTML = '';

  if (hasRecurring) {
    const lbl = document.createElement('div');
    lbl.className = 'day-section-label';
    lbl.textContent = '📌 Aulas Avulsas';
    elDayLessons.appendChild(lbl);
  }

  if (lessons.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'lessons__empty';
    empty.innerHTML = `
      <span class="lessons__empty-icon">${hasRecurring ? '➕' : '📋'}</span>
      <p class="lessons__empty-text">${hasRecurring
        ? 'Adicione aulas avulsas para este dia.'
        : 'Nenhuma aula cadastrada neste dia.'}</p>
    `;
    elDayLessons.appendChild(empty);
    return;
  }

  lessons.forEach(lesson => elDayLessons.appendChild(createLessonCard(lesson)));
}

function createLessonCard(lesson) {
  const card = document.createElement('div');
  card.className = 'lesson-card';
  card.dataset.id = lesson.id;

  const schoolHtml = lesson.school
    ? `<span class="lesson-card__school">📍 ${escapeHtml(lesson.school)}</span>` : '';
  const notesHtml = lesson.notes
    ? `<p class="lesson-card__notes">${escapeHtml(lesson.notes)}</p>` : '';

  card.innerHTML = `
    <div class="lesson-card__time">${escapeHtml(lesson.time)}</div>
    <div class="lesson-card__body">
      <div class="lesson-card__name">${escapeHtml(lesson.name)}</div>
      <div class="lesson-card__meta">${schoolHtml}</div>
      ${notesHtml}
    </div>
    <div class="lesson-card__actions">
      <button class="icon-btn icon-btn--edit"   aria-label="Editar"  data-action="edit"   data-id="${lesson.id}">✏️</button>
      <button class="icon-btn icon-btn--delete" aria-label="Excluir" data-action="delete" data-id="${lesson.id}">🗑️</button>
    </div>
  `;

  card.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit')   startEditLesson(lesson);
    if (btn.dataset.action === 'delete') deleteLessonHandler(lesson.id);
  });

  return card;
}

/* ──────────────────────────────────────────────────────────────
   9. FORMULÁRIO DE AULA AVULSA
   ────────────────────────────────────────────────────────────── */

function resetLessonForm() {
  lessonForm.reset();
  fEditId.value = '';
  formHeading.textContent = '+ Nova Aula Avulsa';
  formSection.classList.remove('is-editing');
  [fTime, fName].forEach(el => el.classList.remove('is-error'));
}

function startEditLesson(lesson) {
  fEditId.value = lesson.id;
  fTime.value   = lesson.time;
  fName.value   = lesson.name;
  fSchool.value = lesson.school || '';
  fNotes.value  = lesson.notes  || '';
  formHeading.textContent = '✏️ Editando Aula';
  formSection.classList.add('is-editing');
  fTime.focus();
  formSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function validateLessonForm() {
  let ok = true;
  [fTime, fName].forEach(el => el.classList.remove('is-error'));
  if (!fTime.value)        { fTime.classList.add('is-error'); ok = false; }
  if (!fName.value.trim()) { fName.classList.add('is-error'); ok = false; }
  if (!ok) showToast('Preencha o horário e o nome da aula.', 'error');
  return ok;
}

function handleLessonFormSubmit(e) {
  e.preventDefault();
  if (!validateLessonForm()) return;

  const data = {
    time:   fTime.value,
    name:   fName.value.trim(),
    school: fSchool.value.trim(),
    notes:  fNotes.value.trim()
  };

  if (fEditId.value) {
    updateLesson(state.selectedDate, fEditId.value, data);
    showToast('Aula atualizada! ✅', 'success');
  } else {
    addLesson(state.selectedDate, data);
    showToast('Aula adicionada! 🎉', 'success');
  }

  resetLessonForm();
  renderDayLessons();
  renderCalendar();
}

function deleteLessonHandler(id) {
  removeLesson(state.selectedDate, id);
  renderDayLessons();
  renderCalendar();
  showToast('Aula removida.', 'info');
}

/* ──────────────────────────────────────────────────────────────
   10. MODAL DE TURMAS (NOVO v2)
   ────────────────────────────────────────────────────────────── */
const classesOverlay   = document.getElementById('classes-overlay');
const classesList      = document.getElementById('classes-list');
const classForm        = document.getElementById('class-form');
const classFormSection = document.getElementById('class-form-section');
const classFormHeading = document.getElementById('class-form-heading');
const cfEditId         = document.getElementById('class-edit-id');
const cfName           = document.getElementById('cf-name');
const cfLevel          = document.getElementById('cf-level');
const cfSchool         = document.getElementById('cf-school');
const cfTime           = document.getElementById('cf-time');
const cfNotes          = document.getElementById('cf-notes');
const weekdayBtns      = document.querySelectorAll('.weekday-btn');

let selectedWeekdays = [];

function openClassesModal() {
  renderClassesList();
  resetClassForm();
  classesOverlay.removeAttribute('hidden');
  requestAnimationFrame(() => classesOverlay.classList.add('is-open'));
}

function closeClassesModal() {
  classesOverlay.classList.remove('is-open');
  classesOverlay.addEventListener('transitionend', () => {
    classesOverlay.setAttribute('hidden', '');
  }, { once: true });
}

function renderClassesList() {
  classesList.innerHTML = '';

  if (state.classes.length === 0) {
    classesList.innerHTML = `
      <div class="lessons__empty">
        <span class="lessons__empty-icon">🏫</span>
        <p class="lessons__empty-text">Nenhuma turma cadastrada ainda.</p>
      </div>
    `;
    return;
  }

  state.classes.forEach(cls => classesList.appendChild(createClassCard(cls)));
}

function createClassCard(cls) {
  const card = document.createElement('div');
  card.className = 'class-card';
  card.dataset.id = cls.id;

  const daysLabel = (cls.days || [])
    .sort((a, b) => a - b)
    .map(d => WEEKDAY_NAMES[d])
    .join(', ') || '—';

  card.innerHTML = `
    <div class="class-card__icon">🏫</div>
    <div class="class-card__body">
      <div class="class-card__name">${escapeHtml(cls.name)}</div>
      <div class="class-card__tags">
        ${cls.level  ? `<span class="tag tag--teal">${escapeHtml(cls.level)}</span>` : ''}
        ${cls.school ? `<span class="tag tag--amber">📍 ${escapeHtml(cls.school)}</span>` : ''}
        <span class="tag tag--green">🕐 ${escapeHtml(cls.time)}</span>
      </div>
      <div class="class-card__days">📅 ${daysLabel}</div>
      ${cls.notes ? `<div class="recurring-card__notes">${escapeHtml(cls.notes)}</div>` : ''}
    </div>
    <div class="class-card__actions">
      <button class="icon-btn icon-btn--edit"   aria-label="Editar turma"  data-action="edit"   data-id="${cls.id}">✏️</button>
      <button class="icon-btn icon-btn--delete" aria-label="Excluir turma" data-action="delete" data-id="${cls.id}">🗑️</button>
    </div>
  `;

  card.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit')   startEditClass(cls);
    if (btn.dataset.action === 'delete') deleteClassHandler(cls.id);
  });

  return card;
}

/* ──────────────────────────────────────────────────────────────
   11. FORMULÁRIO DE TURMA (NOVO v2)
   ────────────────────────────────────────────────────────────── */

function resetClassForm() {
  classForm.reset();
  cfEditId.value   = '';
  selectedWeekdays = [];
  syncWeekdayBtns();
  classFormHeading.textContent = '+ Nova Turma';
  classFormSection.classList.remove('is-editing');
  [cfName, cfTime].forEach(el => el.classList.remove('is-error'));
}

function syncWeekdayBtns() {
  weekdayBtns.forEach(btn => {
    btn.classList.toggle('is-selected', selectedWeekdays.includes(Number(btn.dataset.day)));
  });
}

function startEditClass(cls) {
  cfEditId.value   = cls.id;
  cfName.value     = cls.name;
  cfLevel.value    = cls.level  || '';
  cfSchool.value   = cls.school || '';
  cfTime.value     = cls.time;
  cfNotes.value    = cls.notes  || '';
  selectedWeekdays = [...(cls.days || [])];
  syncWeekdayBtns();
  classFormHeading.textContent = '✏️ Editando Turma';
  classFormSection.classList.add('is-editing');
  cfName.focus();
  classFormSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function validateClassForm() {
  let ok = true;
  [cfName, cfTime].forEach(el => el.classList.remove('is-error'));
  if (!cfName.value.trim()) { cfName.classList.add('is-error'); ok = false; }
  if (!cfTime.value)        { cfTime.classList.add('is-error'); ok = false; }
  if (selectedWeekdays.length === 0) {
    showToast('Selecione pelo menos um dia da semana.', 'error');
    return false;
  }
  if (!ok) showToast('Preencha o nome e horário da turma.', 'error');
  return ok;
}

function handleClassFormSubmit(e) {
  e.preventDefault();
  if (!validateClassForm()) return;

  const data = {
    name:   cfName.value.trim(),
    level:  cfLevel.value.trim(),
    school: cfSchool.value.trim(),
    time:   cfTime.value,
    days:   [...selectedWeekdays].sort((a, b) => a - b),
    notes:  cfNotes.value.trim()
  };

  if (cfEditId.value) {
    updateClass(cfEditId.value, data);
    showToast('Turma atualizada! ✅', 'success');
  } else {
    addClass(data);
    showToast('Turma cadastrada! 🏫', 'success');
  }

  resetClassForm();
  renderClassesList();
  renderCalendar();
}

function deleteClassHandler(id) {
  removeClass(id);
  renderClassesList();
  renderCalendar();
  showToast('Turma removida.', 'info');
}

/* ──────────────────────────────────────────────────────────────
   12. MODAL DE RESUMO — agrupado por turma (ATUALIZADO v2)
   ────────────────────────────────────────────────────────────── */
const summaryOverlay = document.getElementById('summary-overlay');
const summaryTitle   = document.getElementById('summary-title');
const summaryContent = document.getElementById('summary-content');
const tabWeek        = document.getElementById('tab-week');
const tabMonth       = document.getElementById('tab-month');

let activeTab = 'week';

function openSummaryModal() {
  activeTab = 'week';
  updateTabs();
  renderSummary();
  summaryOverlay.removeAttribute('hidden');
  requestAnimationFrame(() => summaryOverlay.classList.add('is-open'));
}

function closeSummaryModal() {
  summaryOverlay.classList.remove('is-open');
  summaryOverlay.addEventListener('transitionend', () => {
    summaryOverlay.setAttribute('hidden', '');
  }, { once: true });
}

function updateTabs() {
  tabWeek.classList.toggle('tabs__tab--active',  activeTab === 'week');
  tabMonth.classList.toggle('tabs__tab--active', activeTab === 'month');
  tabWeek.setAttribute('aria-selected',  String(activeTab === 'week'));
  tabMonth.setAttribute('aria-selected', String(activeTab === 'month'));
}

/** Renderiza o resumo agrupado por turma → dia → horário */
function renderSummary() {
  let startKey, endKey, titleText;

  if (activeTab === 'week') {
    const today = new Date();
    startKey  = toDateKey(getWeekStart(today));
    endKey    = toDateKey(getWeekEnd(today));
    titleText = 'Resumo da Semana';
  } else {
    const y = state.year, m = state.month;
    startKey  = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    endKey    = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    titleText = `Resumo de ${MONTHS_PT[m]} ${y}`;
  }

  summaryTitle.textContent = titleText;
  summaryContent.innerHTML = '';

  const grouped = collectByClass(startKey, endKey);

  if (grouped.size === 0) {
    summaryContent.innerHTML = `
      <div class="summary__empty">
        <span class="summary__empty-icon">📅</span>
        <p>Nenhuma aula registrada neste período.</p>
      </div>
    `;
    return;
  }

  // Ordena: turmas nomeadas antes de avulsas
  const sortedKeys = [...grouped.keys()].sort((a, b) => {
    if (a === '__avulsas') return 1;
    if (b === '__avulsas') return -1;
    const ca = state.classes.find(c => c.id === a);
    const cb = state.classes.find(c => c.id === b);
    return (ca?.name || '').localeCompare(cb?.name || '');
  });

  sortedKeys.forEach(groupKey => {
    const { classInfo, byDate } = grouped.get(groupKey);
    const isAvulsas = groupKey === '__avulsas';

    let totalCount = 0;
    byDate.forEach(items => { totalCount += items.length; });

    const group = document.createElement('div');
    group.className = 'turma-group';

    if (isAvulsas) {
      group.innerHTML = `
        <div class="turma-group__header" style="background:var(--c-accent)">
          <span class="turma-group__name">📌 Aulas Avulsas</span>
          <div class="turma-group__meta">
            <span class="turma-group__tag">${totalCount} aula${totalCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      `;
    } else {
      const cls = classInfo;
      group.innerHTML = `
        <div class="turma-group__header">
          <span class="turma-group__name">🏫 ${escapeHtml(cls.name)}</span>
          <div class="turma-group__meta">
            ${cls.level  ? `<span class="turma-group__tag">${escapeHtml(cls.level)}</span>` : ''}
            ${cls.school ? `<span class="turma-group__tag">📍 ${escapeHtml(cls.school)}</span>` : ''}
            <span class="turma-group__tag">${totalCount} aula${totalCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      `;
    }

    // Sub-grupos por dia
    [...byDate.keys()].sort().forEach(dateKey => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const dayLabel  = new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      const dayBlock = document.createElement('div');
      dayBlock.className = 'day-group';
      dayBlock.innerHTML = `<div class="day-group__header">${dayLabel}</div>`;

      byDate.get(dateKey).forEach(item => {
        const el = document.createElement('div');
        el.className = 'summary-lesson';
        el.innerHTML = `
          <span class="summary-lesson__time">${escapeHtml(item.time)}</span>
          <div class="summary-lesson__info">
            <div class="summary-lesson__name">
              ${escapeHtml(item.name)}
              ${item._type === 'recurring'
                ? `<span class="summary-fixed-badge">FIXO</span>`
                : ''}
            </div>
            ${item.notes ? `<div class="summary-lesson__notes">${escapeHtml(item.notes)}</div>` : ''}
          </div>
        `;
        dayBlock.appendChild(el);
      });

      group.appendChild(dayBlock);
    });

    summaryContent.appendChild(group);
  });
}

/* ──────────────────────────────────────────────────────────────
   13. TOAST
   ────────────────────────────────────────────────────────────── */
const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(msg, type = 'info', duration = 2800) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = `toast toast--${type} is-visible`;
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), duration);
}

/* ──────────────────────────────────────────────────────────────
   14. EVENTOS DE INTERFACE
   ────────────────────────────────────────────────────────────── */

// Navegação de meses
document.getElementById('btn-prev').addEventListener('click', () => {
  state.month--;
  if (state.month < 0) { state.month = 11; state.year--; }
  renderCalendar();
});

document.getElementById('btn-next').addEventListener('click', () => {
  state.month++;
  if (state.month > 11) { state.month = 0; state.year++; }
  renderCalendar();
});

document.getElementById('btn-today').addEventListener('click', () => {
  const now  = new Date();
  state.year  = now.getFullYear();
  state.month = now.getMonth();
  renderCalendar();
});

// Modal Turmas
document.getElementById('btn-classes').addEventListener('click', openClassesModal);
document.getElementById('classes-modal-close').addEventListener('click', closeClassesModal);
classesOverlay.addEventListener('click', e => {
  if (e.target === classesOverlay) closeClassesModal();
});

// Formulário de turma
classForm.addEventListener('submit', handleClassFormSubmit);
document.getElementById('class-form-cancel').addEventListener('click', resetClassForm);

// Picker de dias da semana
weekdayBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const day = Number(btn.dataset.day);
    if (selectedWeekdays.includes(day)) {
      selectedWeekdays = selectedWeekdays.filter(d => d !== day);
    } else {
      selectedWeekdays.push(day);
    }
    syncWeekdayBtns();
  });
});

// Modal do dia
document.getElementById('day-modal-close').addEventListener('click', closeDayModal);
dayOverlay.addEventListener('click', e => {
  if (e.target === dayOverlay) closeDayModal();
});
lessonForm.addEventListener('submit', handleLessonFormSubmit);
document.getElementById('form-cancel').addEventListener('click', resetLessonForm);

// Modal de resumo
document.getElementById('btn-summary').addEventListener('click', openSummaryModal);
document.getElementById('summary-modal-close').addEventListener('click', closeSummaryModal);
summaryOverlay.addEventListener('click', e => {
  if (e.target === summaryOverlay) closeSummaryModal();
});
tabWeek.addEventListener('click', () => {
  activeTab = 'week'; updateTabs(); renderSummary();
});
tabMonth.addEventListener('click', () => {
  activeTab = 'month'; updateTabs(); renderSummary();
});

// Fechar qualquer modal com Escape
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (dayOverlay.classList.contains('is-open'))      closeDayModal();
  if (summaryOverlay.classList.contains('is-open'))  closeSummaryModal();
  if (classesOverlay.classList.contains('is-open'))  closeClassesModal();
});

/* ──────────────────────────────────────────────────────────────
   15. INICIALIZAÇÃO
   ────────────────────────────────────────────────────────────── */
(function init() {
  loadFromStorage();
  renderCalendar();
})();
