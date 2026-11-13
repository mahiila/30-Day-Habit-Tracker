const TOTAL_DAYS = 30;
const TARGET_PERCENT = 90;
const MAX_HABITS = 8;
const DEFAULT_HABITS = [
  { id: "h1", name: "Limit Phone Use", action: "Phone on silent and away from me. No social media, videos, or unnecessary phone use.", time: "5:00–7:00 PM", duration: "2 hours" },
  { id: "h2", name: "Set Up Study Space", action: "Clear unnecessary items, arrange books and stationery, prepare study materials.", time: "8:00 AM", duration: "10 minutes" },
  { id: "h3", name: "Focused Study", action: "Pick one study topic first. Phone only for study (PDFs, lectures). No unrelated apps or task switching.", time: "8:10–9:10 PM", duration: "1 hour" }
];
const STORAGE_KEY = "deepWork30DayTracker_v2";
let state = null;
let selectedDate = null;
let calendarMonth = null;
let toastTimer;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseLocalDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}
function dayDifference(a, b) {
  return Math.round((parseLocalDate(b) - parseLocalDate(a)) / 86400000);
}
function formatDate(value, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  return parseLocalDate(value).toLocaleDateString(undefined, options);
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.startDate && saved.records && Array.isArray(saved.habits) && saved.totalDays === TOTAL_DAYS) return saved;
  } catch (error) {
    console.warn("Could not read saved tracker data.", error);
  }
  return null;
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function getTodayIndex() { return dayDifference(state.startDate, localDateString(new Date())); }
function getElapsedDays() { return Math.max(0, Math.min(TOTAL_DAYS, getTodayIndex() + 1)); }
function getEndDate() { return localDateString(addDays(parseLocalDate(state.startDate), TOTAL_DAYS - 1)); }
function dateAt(i) { return localDateString(addDays(parseLocalDate(state.startDate), i)); }
function doneIds(date) {
  const ids = state.habits.map(h => h.id);
  return (state.records[date] || []).filter(id => ids.includes(id));
}
function isDone(date, id) { return doneIds(date).includes(id); }
function countDone(date) { return doneIds(date).length; }
function allDone(date) { return state.habits.length > 0 && countDone(date) === state.habits.length; }
function getOverallStats() {
  const n = state.habits.length;
  let totalTicks = 0;
  for (let i = 0; i < TOTAL_DAYS; i++) totalTicks += countDone(dateAt(i));
  const completion = n ? (totalTicks / (n * TOTAL_DAYS)) * 100 : 0;
  const elapsed = getElapsedDays();
  const perTask = state.habits.map(h => {
    if (!elapsed) return { done: 0, pct: 0 };
    let done = 0;
    for (let i = 0; i < elapsed; i++) if (isDone(dateAt(i), h.id)) done++;
    return { done, pct: (done / elapsed) * 100 };
  });
  const average = n ? perTask.reduce((a, b) => a + b.pct, 0) / n : 0;
  const expected = TARGET_PERCENT * (elapsed / TOTAL_DAYS);
  return { totalTicks, completion, perTask, average, expected, elapsed, n };
}
function getStreak() {
  let cursor = Math.min(getTodayIndex(), TOTAL_DAYS - 1);
  if (cursor < 0) return 0;
  let streak = 0;
  if (cursor === getTodayIndex() && !allDone(dateAt(cursor))) cursor--;
  while (cursor >= 0) {
    if (!allDone(dateAt(cursor))) break;
    streak++;
    cursor--;
  }
  return streak;
}
function getRating(percent) {
  if (percent >= 100) return ["Excellent 🏆", "You completed every daily habit."];
  if (percent >= 90) return ["On target ✓", "You're meeting your 90% goal."];
  if (percent >= 80) return ["Almost there", "You're close to your final target."];
  if (percent >= 60) return ["Needs work", "A little more consistency will help."];
  return ["Building momentum", "Keep showing up."];
}
function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2200);
}
function startChallenge(date) {
  if (!date) return showToast("Please choose a start date.");
  const chosen = parseLocalDate(date);
  const today = parseLocalDate(localDateString(new Date()));
  if (chosen < today && !confirm("This start date is in the past. Start the challenge from this date?")) return;
  state = { startDate: date, totalDays: TOTAL_DAYS, targetPercent: TARGET_PERCENT, habits: DEFAULT_HABITS.map(h => ({ ...h })), records: {} };
  selectedDate = date;
  calendarMonth = new Date(chosen.getFullYear(), chosen.getMonth(), 1);
  saveState();
  render();
}
function isChallengeDate(date) {
  const d = dayDifference(state.startDate, date);
  return d >= 0 && d < TOTAL_DAYS;
}
function isFuture(date) { return date > localDateString(new Date()); }
function isPast(date) { return date < localDateString(new Date()); }

function toggleTask(id) {
  if (!selectedDate || !isChallengeDate(selectedDate) || isFuture(selectedDate)) return;
  const done = isDone(selectedDate, id);
  if (isPast(selectedDate)) {
    const msg = done ? "Remove this completed mark?" : "Mark this missed task as completed?";
    if (!confirm(`${formatDate(selectedDate, { day: "numeric", month: "short" })}: ${msg}`)) return;
  }
  const ids = doneIds(selectedDate).filter(x => x !== id);
  if (!done) ids.push(id);
  state.records[selectedDate] = ids;
  saveState();
  render();
}
function addHabit() {
  const name = $("newName").value.trim();
  if (!name) return showToast("Please enter a habit name.");
  if (state.habits.length >= MAX_HABITS) return showToast(`You can have at most ${MAX_HABITS} habits.`);
  state.habits.push({
    id: "h" + Date.now(),
    name,
    action: $("newAction").value.trim(),
    time: $("newTime").value.trim(),
    duration: $("newDuration").value.trim()
  });
  ["newName", "newAction", "newTime", "newDuration"].forEach(id => $(id).value = "");
  saveState();
  render();
  showToast("Habit added.");
}
function deleteHabit(id) {
  if (state.habits.length <= 1) return showToast("Keep at least one habit.");
  const habit = state.habits.find(h => h.id === id);
  if (!habit || !confirm(`Delete "${habit.name}"? Its past progress will be removed too.`)) return;
  state.habits = state.habits.filter(h => h.id !== id);
  for (const date in state.records) state.records[date] = state.records[date].filter(x => x !== id);
  saveState();
  render();
  showToast("Habit deleted.");
}
function renderManage() {
  $("manageList").innerHTML = state.habits.map(h => `
    <li>
      <div><strong>${esc(h.name)}</strong><small>${esc([h.time, h.duration].filter(Boolean).join(" · "))}</small></div>
      <button class="delete-habit" data-del="${h.id}" aria-label="Delete ${esc(h.name)}">Delete</button>
    </li>`).join("");
  $("manageList").querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => deleteHabit(b.dataset.del)));
}
function renderSetup() {
  $("setupScreen").classList.toggle("hidden", !!state);
  $("tracker").classList.toggle("hidden", !state);
  if (!state) {
    $("setupHabits").innerHTML = DEFAULT_HABITS.map((h, i) => `<li><span class="dot">${i + 1}</span><span>${esc(h.name)}</span><span>${esc(h.time)} · ${esc(h.duration)}</span></li>`).join("");
    $("startDate").value = localDateString(new Date());
    $("startDate").min = localDateString(new Date());
  }
}
function renderDashboard() {
  const stats = getOverallStats();
  const N = stats.n;
  const todayIndex = getTodayIndex();
  const currentDay = Math.max(0, Math.min(TOTAL_DAYS, todayIndex + 1));
  const hour = new Date().getHours();
  $("greeting").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const range = `${formatDate(state.startDate, { day: "numeric", month: "short" })} – ${formatDate(getEndDate(), { day: "numeric", month: "short", year: "numeric" })}`;
  const today = localDateString(new Date());
  if (todayIndex < 0) {
    $("heroDayLabel").textContent = `Starts ${formatDate(state.startDate, { day: "numeric", month: "short" })} · ${range}`;
    $("statusLine").textContent = "Not started yet";
    $("dayValue").textContent = "—";
  } else if (todayIndex >= TOTAL_DAYS) {
    $("heroDayLabel").textContent = `Challenge finished · ${range}`;
    $("statusLine").textContent = "Finished";
    $("dayValue").textContent = `${TOTAL_DAYS}/${TOTAL_DAYS}`;
  } else {
    $("heroDayLabel").textContent = `Day ${currentDay} of ${TOTAL_DAYS} · ${range}`;
    const n = countDone(today);
    $("statusLine").textContent = n === 0 ? "You haven't checked off any habits yet" : n === N ? `All ${N} done today` : `${n} of ${N} done today`;
    $("dayValue").textContent = `${currentDay}/${TOTAL_DAYS}`;
  }
  $("overallSub").textContent = `of all ${N * TOTAL_DAYS} habits`;
  $("heroProgressBar").style.width = `${stats.completion}%`;
  $("heroProgressText").textContent = `${stats.completion.toFixed(0)}%`;
  $("completionValue").textContent = `${stats.completion.toFixed(1)}%`;
  $("averageValue").textContent = `${stats.average.toFixed(1)}%`;
  $("streakValue").textContent = getStreak();
  $("actualValue").textContent = `${stats.completion.toFixed(1)}%`;
  $("expectedValue").textContent = `${stats.expected.toFixed(1)}%`;
  $("targetValue").textContent = `${TARGET_PERCENT}%`;
  $("benchmarkFill").style.width = `${Math.min(100, stats.completion)}%`;
  $("expectedMarker").style.left = `${Math.min(100, stats.expected)}%`;
  const onTrack = stats.completion >= stats.expected;
  $("benchmarkStatus").textContent = onTrack ? "On track" : "Behind";
  $("benchmarkStatus").classList.toggle("on-track", onTrack);
  const [rating, hint] = getRating(stats.completion);
  $("ratingLabel").textContent = rating;
  $("ratingHint").textContent = hint;
}
function renderCalendar() {
  const start = parseLocalDate(state.startDate);
  const end = parseLocalDate(getEndDate());
  const minMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const maxMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  if (calendarMonth < minMonth) calendarMonth = minMonth;
  if (calendarMonth > maxMonth) calendarMonth = maxMonth;
  $("prevMonth").disabled = calendarMonth <= minMonth;
  $("nextMonth").disabled = calendarMonth >= maxMonth;
  $("calendarTitle").textContent = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const todayStr = localDateString(new Date());
  const N = state.habits.length;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - firstWeekday + i, 12);
    const date = localDateString(d);
    const inside = isChallengeDate(date);
    const future = date > todayStr;
    const count = inside ? countDone(date) : 0;
    let classes = "calendar-day";
    if (d.getMonth() !== month) classes += " other-month";
    if (!inside) classes += " outside";
    if (inside && N && count === N) classes += " complete";
    else if (inside && count > 0) classes += count / N < 0.5 ? " partial-1" : " partial-2";
    if (inside && isPast(date) && count === 0) classes += " missed";
    if (inside && future) classes += " future";
    if (date === selectedDate) classes += " selected";
    if (date === todayStr) classes += " today";
    const disabled = !inside || future ? "disabled" : "";
    cells.push(`<button class="${classes}" data-date="${date}" ${disabled} aria-label="${formatDate(date)}${inside ? `, ${count} of ${N} completed` : ""}">${d.getDate()}</button>`);
  }
  $("calendarGrid").innerHTML = cells.join("");
  $("calendarGrid").querySelectorAll("[data-date]").forEach(button => {
    button.addEventListener("click", () => { selectedDate = button.dataset.date; render(); });
  });
}
function renderTaskPanel() {
  const date = selectedDate;
  const dayIndex = dayDifference(state.startDate, date);
  const count = countDone(date);
  const N = state.habits.length;
  const today = localDateString(new Date());
  const future = date > today;
  const past = date < today;
  const stats = getOverallStats();
  $("selectedDayTitle").textContent = `Day ${dayIndex + 1}`;
  $("selectedDateText").textContent = formatDate(date);
  $("dayState").textContent = date === today ? "TODAY" : past ? "PAST DAY" : "LOCKED";
  $("dayInstruction").textContent = future
    ? "This day is locked until the date arrives."
    : past ? "Forgot to tick something? Tap a habit to fix it. You'll be asked to confirm."
    : "Check off each habit once you've completed its daily goal.";
  $("taskList").innerHTML = state.habits.map((h, index) => {
    const done = isDone(date, h.id);
    const missed = past && !done;
    const stateText = done ? "Done" : missed ? "Missed" : "";
    const buttonClass = done ? "task-status done" : missed ? "task-status missed" : "task-status";
    const mark = done ? "✓" : missed ? "×" : "";
    const pt = stats.perTask[index];
    const when = [h.time, h.duration].filter(Boolean).join(" · ");
    return `<div class="task-item ${done ? "done" : ""}">
      <button class="${buttonClass}" data-task="${h.id}" ${future ? "disabled" : ""} aria-label="${done ? "Unmark" : "Mark"} ${esc(h.name)}">${mark}</button>
      <div class="task-copy">
        <div class="task-top"><strong>${esc(h.name)}</strong><span class="task-state">${stateText}</span></div>
        ${h.action ? `<p class="task-action">${esc(h.action)}</p>` : ""}
        <small>${esc(when)}${when ? " · " : ""}${pt.done} of ${stats.elapsed} days (${pt.pct.toFixed(0)}%)</small>
        <div class="mini-track"><span style="width:${pt.pct}%"></span></div>
      </div>
    </div>`;
  }).join("");
  $("taskList").querySelectorAll("[data-task]").forEach(button => button.addEventListener("click", () => toggleTask(button.dataset.task)));
  $("dailySuccess").classList.toggle("hidden", !(N && count === N));
  $("dailySuccess").querySelector("span").textContent = `You've completed all ${N} habits today.`;
  $("challengeSuccess").classList.toggle("hidden", !(N && stats.totalTicks === N * TOTAL_DAYS));
  $("challengeSuccess").querySelector("p").textContent = `You completed all ${N * TOTAL_DAYS} habits.`;
}
function renderHistory() {
  const today = localDateString(new Date());
  const N = state.habits.length;
  $("historyHead").innerHTML = `<tr><th>Day / Date</th>${state.habits.map(h => `<th>${esc(h.name)}</th>`).join("")}<th>Daily %</th></tr>`;
  $("historyBody").innerHTML = Array.from({ length: TOTAL_DAYS }, (_, index) => {
    const date = dateAt(index);
    const future = date > today;
    const dailyPercent = N ? Math.round((countDone(date) / N) * 100) : 0;
    const cells = state.habits.map(h => {
      const done = isDone(date, h.id);
      return future ? '<td class="pending">—</td>' : `<td class="${done ? "yes" : "no"}">${done ? "✓" : "✗"}</td>`;
    }).join("");
    return `<tr class="${future ? "future-row" : ""}"><td><strong>Day ${index + 1}</strong><br><span>${formatDate(date, { day: "numeric", month: "short" })}</span></td>${cells}<td>${future ? "—" : `${dailyPercent}%`}</td></tr>`;
  }).join("");
}
function render() {
  renderSetup();
  if (!state) return;
  if (!selectedDate || !isChallengeDate(selectedDate) || isFuture(selectedDate)) {
    const today = localDateString(new Date());
    selectedDate = today < state.startDate ? state.startDate : today > getEndDate() ? getEndDate() : today;
  }
  renderDashboard();
  renderCalendar();
  renderTaskPanel();
  renderHistory();
  renderManage();
}
function resetChallenge() {
  if (!confirm("Reset your entire 30-day challenge? All saved progress and habit changes will be permanently cleared from this browser.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = null;
  selectedDate = null;
  calendarMonth = null;
  $("historyModal").classList.add("hidden");
  $("manageModal").classList.add("hidden");
  render();
}
const closeModals = () => { $("historyModal").classList.add("hidden"); $("manageModal").classList.add("hidden"); };
$("startButton").addEventListener("click", () => startChallenge($("startDate").value));
$("startTodayButton").addEventListener("click", () => startChallenge(localDateString(new Date())));
$("resetButton").addEventListener("click", resetChallenge);
$("historyBtn").addEventListener("click", () => $("historyModal").classList.remove("hidden"));
$("manageBtn").addEventListener("click", () => $("manageModal").classList.remove("hidden"));
$("addHabitBtn").addEventListener("click", addHabit);
$("closeHistory").addEventListener("click", closeModals);
$("closeManage").addEventListener("click", closeModals);
$("modalBackdrop").addEventListener("click", closeModals);
$("manageBackdrop").addEventListener("click", closeModals);
$("prevMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); renderCalendar(); });
$("nextMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); renderCalendar(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModals(); });
state = loadState();
if (state) {
  const today = localDateString(new Date());
  const end = getEndDate();
  selectedDate = today < state.startDate ? state.startDate : today > end ? end : today;
  const selected = parseLocalDate(selectedDate);
  calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
}
render();