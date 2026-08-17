// ---- Config ----
const DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const SESSIONS_PER_CYCLE = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * 100;
const STORAGE_KEY = 'focusflow.state.v1';

// ---- State ----
let state = loadState();
let mode = 'focus';
let secondsLeft = DURATIONS.focus;
let running = false;
let tickHandle = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt storage */ }
  return {
    tasks: [],
    selectedTaskId: null,
    streak: 0,
    lastCompletedDate: null,
    sessionsCompletedInCycle: 0,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---- DOM ----
const el = {
  timeDisplay: document.getElementById('time-display'),
  ring: document.getElementById('ring-progress'),
  startBtn: document.getElementById('start-btn'),
  resetBtn: document.getElementById('reset-btn'),
  skipBtn: document.getElementById('skip-btn'),
  modeTabs: document.querySelectorAll('.mode-tab'),
  taskForm: document.getElementById('task-form'),
  taskInput: document.getElementById('task-input'),
  taskList: document.getElementById('task-list'),
  taskCount: document.getElementById('task-count'),
  emptyHint: document.getElementById('empty-hint'),
  currentTaskLabel: document.getElementById('current-task-label'),
  streakCount: document.getElementById('streak-count'),
  sessionDots: document.getElementById('session-dots'),
  celebration: document.getElementById('celebration'),
};

el.ring.style.strokeDasharray = String(RING_CIRCUMFERENCE);

// ---- Init ----
function init() {
  renderTasks();
  renderStreak();
  renderSessionDots();
  setMode('focus', { resetTimer: true });
  bindEvents();
}

function bindEvents() {
  el.modeTabs.forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode, { resetTimer: true }));
  });
  el.startBtn.addEventListener('click', toggleRunning);
  el.resetBtn.addEventListener('click', () => setMode(mode, { resetTimer: true }));
  el.skipBtn.addEventListener('click', () => finishSession(false));
  el.taskForm.addEventListener('submit', onAddTask);
  el.taskList.addEventListener('click', onTaskListClick);
}

// ---- Mode / Timer ----
function setMode(newMode, { resetTimer }) {
  mode = newMode;
  document.body.className = mode === 'focus' ? '' : `mode-${mode}`;
  el.modeTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  if (resetTimer) {
    pause();
    secondsLeft = DURATIONS[mode];
    updateDisplay();
  }
}

function toggleRunning() {
  if (running) pause(); else start();
}

function start() {
  if (mode === 'focus' && !state.selectedTaskId) {
    const firstOpenTask = state.tasks.find(t => !t.done);
    if (firstOpenTask) {
      state.selectedTaskId = firstOpenTask.id;
      saveState();
      renderTasks();
    }
  }
  running = true;
  el.startBtn.textContent = 'Pause';
  tickHandle = setInterval(tick, 1000);
}

function pause() {
  running = false;
  el.startBtn.textContent = 'Start';
  clearInterval(tickHandle);
}

function tick() {
  secondsLeft -= 1;
  if (secondsLeft <= 0) {
    finishSession(true);
    return;
  }
  updateDisplay();
}

function updateDisplay() {
  const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const s = Math.floor(secondsLeft % 60).toString().padStart(2, '0');
  el.timeDisplay.textContent = `${m}:${s}`;

  const total = DURATIONS[mode];
  const progress = 1 - secondsLeft / total;
  el.ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));

  const task = state.tasks.find(t => t.id === state.selectedTaskId);
  el.currentTaskLabel.textContent = mode === 'focus'
    ? (task ? task.text : 'No task selected')
    : (mode === 'short' ? 'Short break' : 'Long break');

  document.title = `${m}:${s} · Focus Flow`;
}

function finishSession(natural) {
  pause();
  if (mode === 'focus' && natural) {
    onFocusSessionComplete();
  }
  if (mode === 'focus') {
    state.sessionsCompletedInCycle = (state.sessionsCompletedInCycle + 1) % SESSIONS_PER_CYCLE;
    saveState();
    renderSessionDots();
    const nextMode = state.sessionsCompletedInCycle === 0 ? 'long' : 'short';
    setMode(nextMode, { resetTimer: true });
  } else {
    setMode('focus', { resetTimer: true });
  }
  document.title = 'Focus Flow';
}

function onFocusSessionComplete() {
  const task = state.tasks.find(t => t.id === state.selectedTaskId);
  if (task) {
    task.pomos = (task.pomos || 0) + 1;
  }
  bumpStreak();
  saveState();
  renderTasks();
  renderStreak();
  celebrate(task ? `Nice focus! "${task.text}" +1 🍅` : 'Focus session complete!');
}

function bumpStreak() {
  const today = new Date().toDateString();
  if (state.lastCompletedDate === today) {
    return; // already counted today
  }
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (state.lastCompletedDate === yesterday) {
    state.streak += 1;
  } else {
    state.streak = 1;
  }
  state.lastCompletedDate = today;
}

// ---- Session dots ----
function renderSessionDots() {
  el.sessionDots.innerHTML = '';
  for (let i = 0; i < SESSIONS_PER_CYCLE; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i < state.sessionsCompletedInCycle ? ' filled' : '');
    el.sessionDots.appendChild(dot);
  }
}

// ---- Streak ----
function renderStreak() {
  el.streakCount.textContent = state.streak;
}

// ---- Tasks ----
function onAddTask(evt) {
  evt.preventDefault();
  const text = el.taskInput.value.trim();
  if (!text) return;
  const task = { id: crypto.randomUUID(), text, done: false, pomos: 0 };
  state.tasks.unshift(task);
  if (!state.selectedTaskId) state.selectedTaskId = task.id;
  saveState();
  el.taskInput.value = '';
  renderTasks();
}

function onTaskListClick(evt) {
  const item = evt.target.closest('.task-item');
  if (!item) return;
  const id = item.dataset.id;

  if (evt.target.closest('.task-delete')) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    if (state.selectedTaskId === id) state.selectedTaskId = null;
    saveState();
    renderTasks();
    return;
  }

  if (evt.target.closest('.task-check')) {
    const task = state.tasks.find(t => t.id === id);
    task.done = !task.done;
    saveState();
    renderTasks();
    return;
  }

  state.selectedTaskId = id;
  saveState();
  renderTasks();
  if (mode === 'focus') updateDisplay();
}

function renderTasks() {
  el.taskList.innerHTML = '';
  const openCount = state.tasks.filter(t => !t.done).length;
  el.taskCount.textContent = `${openCount} left`;
  el.emptyHint.style.display = state.tasks.length === 0 ? 'block' : 'none';

  for (const task of state.tasks) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '') + (task.id === state.selectedTaskId ? ' selected' : '');
    li.dataset.id = task.id;
    li.innerHTML = `
      <span class="task-check">${task.done ? '✓' : ''}</span>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <span class="task-pomos">${task.pomos ? '🍅×' + task.pomos : ''}</span>
      <button type="button" class="task-delete" title="Delete task">✕</button>
    `;
    el.taskList.appendChild(li);
  }

  const task = state.tasks.find(t => t.id === state.selectedTaskId);
  if (mode === 'focus') {
    el.currentTaskLabel.textContent = task ? task.text : 'No task selected';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Celebration ----
function celebrate(message) {
  spawnConfetti();
  showToast(message);
}

function spawnConfetti() {
  const colors = ['#e8622c', '#3f8f6f', '#f2b544', '#5b7fd1', '#c85fa8'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
    piece.style.opacity = String(0.7 + Math.random() * 0.3);
    el.celebration.appendChild(piece);
    setTimeout(() => piece.remove(), 3500);
  }
}

let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector('.pulse-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'pulse-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

init();
