/**
 * ================================================================
 * PLANNER DO PROFESSOR — app.js
 * Organização: Estado → Storage → Render → Eventos
 * ================================================================
 */

'use strict';

/* ──────────────────────────────────────────────────────────────
   1. ESTADO DA APLICAÇÃO
   ────────────────────────────────────────────────────────────── */

/**
 * Estado global da aplicação.
 * @type {{ year: number, month: number, selectedDate: string|null, lessons: Object }}
 */
const state = {
  year:         new Date().getFullYear(),
  month:        new Date().getMonth(),     // 0 = Janeiro … 11 = Dezembro
  selectedDate: null,                      // string "YYYY-MM-DD"
  lessons:      {}                         // { "YYYY-MM-DD": [ { id, time, name, school, notes } ] }
};

/** Hoje como string ISO sem hora */
const TODAY = toDateKey(new Date());

/* ──────────────────────────────────────────────────────────────
   2. UTILITÁRIOS
   ────────────────────────────────────────────────────────────── */

/**
 * Converte uma Date em "YYYY-MM-DD".
 * @param {Date} d
 * @returns {string}
 */
function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Gera um ID único simples.
 * @returns {string}
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Formata uma data "YYYY-MM-DD" para exibição (ex: "quarta-feira, 14 de maio").
 * @param {string} key
 * @returns {string}
 */
function formatDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/**
 * Retorna o primeiro dia da semana atual (domingo) da semana que contém `date`.
 * @param {Date} date
 * @returns {Date}
 */
function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * Retorna o último dia da semana atual (sábado).
 * @param {Date} date
 * @returns {Date}
 */
function getWeekEnd(date) {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
  return d;
}

/* ──────────────────────────────────────────────────────────────
   3. PERSISTÊNCIA — localStorage
   ────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'teacher-planner-v1';

/** Carrega os dados do localStorage para o estado. */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.lessons = JSON.parse(raw);
  } catch (e) {
    console.warn('Erro ao carregar dados:', e);
    state.lessons = {};
  }
}

/** Salva o estado atual no localStorage. */
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lessons));
  } catch (e) {
    console.warn('Erro ao salvar dados:', e);
  }
}

/* ──────────────────────────────────────────────────────────────
   4. CRUD — Operações sobre aulas
   ────────────────────────────────────────────────────────────── */

/**
 * Retorna as aulas de uma data, ordenadas por horário.
 * @param {string} dateKey
 * @returns {Array}
 */
function getLessons(dateKey) {
  return (state.lessons[dateKey] || []).slice().sort((a, b) =>
    a.time.localeCompare(b.time)
  );
}

/**
 * Adiciona uma nova aula em uma data.
 * @param {string} dateKey
 * @param {{ time, name, school, notes }} data
 * @returns {Object} aula criada
 */
function addLesson(dateKey, data) {
  if (!state.lessons[dateKey]) state.lessons[dateKey] = [];
  const lesson = { id: uid(), ...data };
  state.lessons[dateKey].push(lesson);
  saveToStorage();
  return lesson;
}

/**
 * Atualiza uma aula existente.
 * @param {string} dateKey
 * @param {string} id
 * @param {{ time, name, school, notes }} data
 * @returns {boolean}
 */
function updateLesson(dateKey, id, data) {
  const list = state.lessons[dateKey];
  if (!list) return false;
  const idx = list.findIndex(l => l.id === id);
  if (idx === -1) return false;
  list[idx] = { id, ...data };
  saveToStorage();
  return true;
}

/**
 * Remove uma aula pelo ID.
 * @param {string} dateKey
 * @param {string} id
 */
function removeLesson(dateKey, id) {
  if (!state.lessons[dateKey]) return;
  state.lessons[dateKey] = state.lessons[dateKey].filter(l => l.id !== id);
  if (state.lessons[dateKey].length === 0) delete state.lessons[dateKey];
  saveToStorage();
}

/* ──────────────────────────────────────────────────────────────
   5. RENDERIZAÇÃO DO CALENDÁRIO
   ────────────────────────────────────────────────────────────── */

/** Nomes dos meses em português. */
const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

/** Referências ao DOM. */
const elMonth    = document.getElementById('current-month');
const elYear     = document.getElementById('current-year');
const elGrid     = document.getElementById('calendar-grid');
const elStats    = document.getElementById('calendar-stats');

/**
 * Renderiza o calendário completo para o mês/ano do estado.
 * Gera células para os dias do mês anterior (preenchimento),
 * do mês atual e do próximo (preenchimento).
 */
function renderCalendar() {
  // Atualiza cabeçalho
  elMonth.textContent = MONTHS_PT[state.month];
  elYear.textContent  = state.year;

  // Limpa a grade
  elGrid.innerHTML = '';

  const firstDay = new Date(state.year, state.month, 1);
  const lastDay  = new Date(state.year, state.month + 1, 0);

  // Dias do mês anterior para preencher a grade
  const startOffset = firstDay.getDay(); // 0 = domingo
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(state.year, state.month, 1 - (startOffset - i));
    elGrid.appendChild(createDayCell(d, true));
  }

  // Dias do mês atual
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(state.year, state.month, d);
    elGrid.appendChild(createDayCell(date, false));
  }

  // Dias do próximo mês para completar a última linha
  const totalCells = startOffset + lastDay.getDate();
  const remaining  = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(state.year, state.month + 1, i);
    elGrid.appendChild(createDayCell(date, true));
  }

  // Atualiza estatísticas do mês
  renderStats();
}

/**
 * Cria o elemento HTML de uma célula de dia.
 * @param {Date} date
 * @param {boolean} otherMonth - pertence a outro mês?
 * @returns {HTMLElement}
 */
function createDayCell(date, otherMonth) {
  const key      = toDateKey(date);
  const lessons  = getLessons(key);
  const isToday  = key === TODAY;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const cell = document.createElement('div');
  cell.className = 'day';
  cell.setAttribute('role', 'gridcell');
  cell.setAttribute('aria-label', formatDate(key));
  cell.dataset.date = key;

  if (otherMonth) cell.classList.add('day--other-month');
  if (isToday)    cell.classList.add('day--today');
  if (isWeekend)  cell.classList.add('day--weekend');
  if (lessons.length > 0) cell.classList.add('day--has-lessons');

  // Número do dia
  const numEl = document.createElement('div');
  numEl.className = 'day__number';
  numEl.textContent = date.getDate();

  // Badge de quantidade
  const badge = document.createElement('div');
  badge.className = 'day__badge';
  badge.textContent = lessons.length;

  // Preview das primeiras aulas
  const previews = document.createElement('div');
  previews.className = 'day__previews';

  const MAX_PREVIEW = 2;
  lessons.slice(0, MAX_PREVIEW).forEach(l => {
    const item = document.createElement('div');
    item.className = 'day__preview-item';
    item.textContent = `${l.time} ${l.name}`;
    previews.appendChild(item);
  });

  if (lessons.length > MAX_PREVIEW) {
    const more = document.createElement('div');
    more.className = 'day__preview-more';
    more.textContent = `+${lessons.length - MAX_PREVIEW} mais`;
    previews.appendChild(more);
  }

  cell.appendChild(numEl);
  cell.appendChild(badge);
  cell.appendChild(previews);

  // Evento de clique — abre modal do dia
  if (!otherMonth) {
    cell.addEventListener('click', () => openDayModal(key));
  }

  return cell;
}

/**
 * Renderiza a barra de estatísticas do mês atual.
 */
function renderStats() {
  // Conta aulas e escolas únicas no mês exibido
  let totalLessons = 0;
  const schools = new Set();
  const daysWithLessons = new Set();

  Object.entries(state.lessons).forEach(([key, lessons]) => {
    const [y, m] = key.split('-').map(Number);
    if (y === state.year && m - 1 === state.month) {
      totalLessons += lessons.length;
      daysWithLessons.add(key);
      lessons.forEach(l => { if (l.school) schools.add(l.school.trim()); });
    }
  });

  elStats.innerHTML = `
    <div class="stats__item">
      <span class="stats__label">Aulas no mês</span>
      <span class="stats__value">${totalLessons}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">Dias com aula</span>
      <span class="stats__value">${daysWithLessons.size}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">Escolas / Locais</span>
      <span class="stats__value">${schools.size}</span>
    </div>
  `;
}

/* ──────────────────────────────────────────────────────────────
   6. MODAL DO DIA — abrir / fechar / renderizar
   ────────────────────────────────────────────────────────────── */
const dayOverlay   = document.getElementById('day-overlay');
const elDayTitle   = document.getElementById('modal-day-title');
const elDayLessons = document.getElementById('day-lessons');
const formSection  = document.getElementById('form-section');
const formHeading  = document.getElementById('form-heading');
const lessonForm   = document.getElementById('lesson-form');
const fTime        = document.getElementById('f-time');
const fName        = document.getElementById('f-name');
const fSchool      = document.getElementById('f-school');
const fNotes       = document.getElementById('f-notes');
const fEditId      = document.getElementById('edit-id');

/**
 * Abre o modal do dia para a data fornecida.
 * @param {string} dateKey "YYYY-MM-DD"
 */
function openDayModal(dateKey) {
  state.selectedDate = dateKey;
  elDayTitle.textContent = formatDate(dateKey);
  renderDayLessons();
  resetForm();

  dayOverlay.removeAttribute('hidden');
  // Força reflow para a transição CSS funcionar
  requestAnimationFrame(() => {
    dayOverlay.classList.add('is-open');
  });
}

/** Fecha o modal do dia. */
function closeDayModal() {
  dayOverlay.classList.remove('is-open');
  dayOverlay.addEventListener('transitionend', () => {
    dayOverlay.setAttribute('hidden', '');
    state.selectedDate = null;
    resetForm();
  }, { once: true });
}

/**
 * Renderiza a lista de aulas dentro do modal do dia.
 */
function renderDayLessons() {
  const lessons = getLessons(state.selectedDate);
  elDayLessons.innerHTML = '';

  if (lessons.length === 0) {
    elDayLessons.innerHTML = `
      <div class="lessons__empty">
        <span class="lessons__empty-icon">📋</span>
        <p class="lessons__empty-text">Nenhuma aula cadastrada neste dia.</p>
      </div>
    `;
    return;
  }

  lessons.forEach(lesson => {
    elDayLessons.appendChild(createLessonCard(lesson));
  });
}

/**
 * Cria o elemento HTML de um card de aula.
 * @param {{ id, time, name, school, notes }} lesson
 * @returns {HTMLElement}
 */
function createLessonCard(lesson) {
  const card = document.createElement('div');
  card.className = 'lesson-card';
  card.dataset.id = lesson.id;

  const schoolHtml = lesson.school
    ? `<span class="lesson-card__school">📍 ${escapeHtml(lesson.school)}</span>`
    : '';

  const notesHtml = lesson.notes
    ? `<p class="lesson-card__notes">${escapeHtml(lesson.notes)}</p>`
    : '';

  card.innerHTML = `
    <div class="lesson-card__time">${escapeHtml(lesson.time)}</div>
    <div class="lesson-card__body">
      <div class="lesson-card__name">${escapeHtml(lesson.name)}</div>
      <div class="lesson-card__meta">${schoolHtml}</div>
      ${notesHtml}
    </div>
    <div class="lesson-card__actions">
      <button class="icon-btn icon-btn--edit" aria-label="Editar aula" data-action="edit" data-id="${lesson.id}">✏️</button>
      <button class="icon-btn icon-btn--delete" aria-label="Excluir aula" data-action="delete" data-id="${lesson.id}">🗑️</button>
    </div>
  `;

  // Delegação de eventos nos botões do card
  card.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit')   startEditLesson(lesson);
    if (btn.dataset.action === 'delete') deleteLesson(lesson.id);
  });

  return card;
}

/**
 * Escapa HTML para evitar XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ──────────────────────────────────────────────────────────────
   7. FORMULÁRIO — salvar / editar / cancelar
   ────────────────────────────────────────────────────────────── */

/** Reseta o formulário para o modo "nova aula". */
function resetForm() {
  lessonForm.reset();
  fEditId.value = '';
  formHeading.textContent = '+ Nova Aula';
  formSection.classList.remove('is-editing');
  clearFormErrors();
}

/** Limpa os estados de erro dos campos. */
function clearFormErrors() {
  [fTime, fName, fSchool, fNotes].forEach(el => el.classList.remove('is-error'));
}

/**
 * Preenche o formulário com os dados de uma aula para edição.
 * @param {Object} lesson
 */
function startEditLesson(lesson) {
  fEditId.value = lesson.id;
  fTime.value   = lesson.time;
  fName.value   = lesson.name;
  fSchool.value = lesson.school || '';
  fNotes.value  = lesson.notes  || '';

  formHeading.textContent = '✏️ Editando Aula';
  formSection.classList.add('is-editing');
  fTime.focus();

  // Scroll para o formulário
  formSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Valida os campos obrigatórios do formulário.
 * @returns {boolean}
 */
function validateForm() {
  let valid = true;
  clearFormErrors();

  if (!fTime.value) { fTime.classList.add('is-error'); valid = false; }
  if (!fName.value.trim()) { fName.classList.add('is-error'); valid = false; }

  if (!valid) showToast('Preencha o horário e o nome da aula.', 'error');
  return valid;
}

/**
 * Submete o formulário: cria ou atualiza aula.
 * @param {Event} e
 */
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const data = {
    time:   fTime.value,
    name:   fName.value.trim(),
    school: fSchool.value.trim(),
    notes:  fNotes.value.trim()
  };

  const editId = fEditId.value;

  if (editId) {
    // Modo edição
    updateLesson(state.selectedDate, editId, data);
    showToast('Aula atualizada! ✅', 'success');
  } else {
    // Modo criação
    addLesson(state.selectedDate, data);
    showToast('Aula adicionada! 🎉', 'success');
  }

  resetForm();
  renderDayLessons();
  renderCalendar(); // atualiza a grade do calendário
}

/**
 * Remove uma aula após confirmação implícita (duplo clique rápido).
 * @param {string} id
 */
function deleteLesson(id) {
  removeLesson(state.selectedDate, id);
  renderDayLessons();
  renderCalendar();
  showToast('Aula removida.', 'info');
}

/* ──────────────────────────────────────────────────────────────
   8. MODAL DE RESUMO — Semana / Mês
   ────────────────────────────────────────────────────────────── */
const summaryOverlay  = document.getElementById('summary-overlay');
const summaryTitle    = document.getElementById('summary-title');
const summaryContent  = document.getElementById('summary-content');
const tabWeek         = document.getElementById('tab-week');
const tabMonth        = document.getElementById('tab-month');

/** Aba ativa no resumo: 'week' | 'month' */
let activeTab = 'week';

/** Abre o modal de resumo. */
function openSummaryModal() {
  activeTab = 'week';
  updateTabs();
  renderSummary();

  summaryOverlay.removeAttribute('hidden');
  requestAnimationFrame(() => {
    summaryOverlay.classList.add('is-open');
  });
}

/** Fecha o modal de resumo. */
function closeSummaryModal() {
  summaryOverlay.classList.remove('is-open');
  summaryOverlay.addEventListener('transitionend', () => {
    summaryOverlay.setAttribute('hidden', '');
  }, { once: true });
}

/** Sincroniza o visual das abas com `activeTab`. */
function updateTabs() {
  tabWeek.classList.toggle('tabs__tab--active',  activeTab === 'week');
  tabMonth.classList.toggle('tabs__tab--active', activeTab === 'month');
  tabWeek.setAttribute('aria-selected',  String(activeTab === 'week'));
  tabMonth.setAttribute('aria-selected', String(activeTab === 'month'));
}

/**
 * Coleta as aulas de um intervalo de datas e as organiza
 * por escola → dia → horário.
 *
 * @param {string} startKey  "YYYY-MM-DD"
 * @param {string} endKey    "YYYY-MM-DD"
 * @returns {Map<string, Map<string, Array>>}
 *   Map { escola → Map { dataKey → [lesson, ...] } }
 */
function collectLessonsBySchool(startKey, endKey) {
  // Map: escola → { dateKey → [lessons] }
  const result = new Map();

  Object.entries(state.lessons).forEach(([dateKey, lessons]) => {
    if (dateKey < startKey || dateKey > endKey) return;

    lessons.forEach(lesson => {
      const school = lesson.school?.trim() || '(Sem local definido)';

      if (!result.has(school)) result.set(school, new Map());
      const byDate = result.get(school);

      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey).push(lesson);
    });
  });

  // Ordena cada lista de aulas por horário
  result.forEach(byDate => {
    byDate.forEach((lessons, key) => {
      byDate.set(key, [...lessons].sort((a, b) => a.time.localeCompare(b.time)));
    });
  });

  return result;
}

/** Renderiza o conteúdo do resumo de acordo com a aba ativa. */
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
    endKey    = `${y}-${String(m + 1).padStart(2, '0')}-${last}`;
    titleText = `Resumo de ${MONTHS_PT[m]} ${y}`;
  }

  summaryTitle.textContent = titleText;

  const grouped = collectLessonsBySchool(startKey, endKey);
  summaryContent.innerHTML = '';

  if (grouped.size === 0) {
    summaryContent.innerHTML = `
      <div class="summary__empty">
        <span class="summary__empty-icon">📅</span>
        <p>Nenhuma aula registrada neste período.</p>
      </div>
    `;
    return;
  }

  // Renderiza agrupado por escola → dia → aula
  grouped.forEach((byDate, school) => {
    const group = document.createElement('div');
    group.className = 'school-group';
    group.setAttribute('aria-label', `Escola: ${school}`);

    // Contagem total de aulas desta escola no período
    let count = 0;
    byDate.forEach(lessons => { count += lessons.length; });

    group.innerHTML = `
      <div class="school-group__header">
        <span class="school-group__name">📍 ${escapeHtml(school)}</span>
        <span class="school-group__count">${count} aula${count > 1 ? 's' : ''}</span>
      </div>
    `;

    // Sub-grupos por dia (ordem cronológica)
    const sortedDates = [...byDate.keys()].sort();
    sortedDates.forEach(dateKey => {
      const dayBlock = document.createElement('div');
      dayBlock.className = 'day-group';

      const [y, m, d] = dateKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayLabel = dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      dayBlock.innerHTML = `
        <div class="day-group__header">${dayLabel}</div>
      `;

      byDate.get(dateKey).forEach(lesson => {
        const item = document.createElement('div');
        item.className = 'summary-lesson';
        item.innerHTML = `
          <span class="summary-lesson__time">${escapeHtml(lesson.time)}</span>
          <div class="summary-lesson__info">
            <div class="summary-lesson__name">${escapeHtml(lesson.name)}</div>
            ${lesson.notes ? `<div class="summary-lesson__notes">${escapeHtml(lesson.notes)}</div>` : ''}
          </div>
        `;
        dayBlock.appendChild(item);
      });

      group.appendChild(dayBlock);
    });

    summaryContent.appendChild(group);
  });
}

/* ──────────────────────────────────────────────────────────────
   9. TOAST — feedback visual
   ────────────────────────────────────────────────────────────── */
const toastEl = document.getElementById('toast');
let toastTimer = null;

/**
 * Exibe um toast de feedback.
 * @param {string} msg  Mensagem a exibir
 * @param {'success'|'error'|'info'} type
 * @param {number} duration  Duração em ms (padrão: 2800)
 */
function showToast(msg, type = 'info', duration = 2800) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = `toast toast--${type} is-visible`;

  toastTimer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, duration);
}

/* ──────────────────────────────────────────────────────────────
   10. EVENTOS DE INTERFACE
   ────────────────────────────────────────────────────────────── */

/** Navegação de meses */
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

/** Botão "Hoje" — volta para o mês atual */
document.getElementById('btn-today').addEventListener('click', () => {
  const now  = new Date();
  state.year  = now.getFullYear();
  state.month = now.getMonth();
  renderCalendar();
});

/** Botão "Ver Resumo" */
document.getElementById('btn-summary').addEventListener('click', openSummaryModal);

/** Fechar modal do dia */
document.getElementById('day-modal-close').addEventListener('click', closeDayModal);

/** Fechar ao clicar no overlay (fora do modal) */
dayOverlay.addEventListener('click', e => {
  if (e.target === dayOverlay) closeDayModal();
});

/** Fechar modal de resumo */
document.getElementById('summary-modal-close').addEventListener('click', closeSummaryModal);

summaryOverlay.addEventListener('click', e => {
  if (e.target === summaryOverlay) closeSummaryModal();
});

/** Abas do resumo */
tabWeek.addEventListener('click', () => {
  activeTab = 'week';
  updateTabs();
  renderSummary();
});

tabMonth.addEventListener('click', () => {
  activeTab = 'month';
  updateTabs();
  renderSummary();
});

/** Submissão do formulário de aula */
lessonForm.addEventListener('submit', handleFormSubmit);

/** Botão "Cancelar" no formulário */
document.getElementById('form-cancel').addEventListener('click', resetForm);

/** Fechar modais com a tecla Escape */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (dayOverlay.classList.contains('is-open'))     closeDayModal();
  if (summaryOverlay.classList.contains('is-open')) closeSummaryModal();
});

/* ──────────────────────────────────────────────────────────────
   11. INICIALIZAÇÃO
   ────────────────────────────────────────────────────────────── */

(function init() {
  loadFromStorage();
  renderCalendar();
})();
