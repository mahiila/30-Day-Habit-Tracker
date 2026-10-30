const TOTAL_DAYS = 30;
const TARGET_PERCENT = 90;
const TASKS = [
  { name: "Limit Digital Distractions", duration: "30 minutes" },
  { name: "Focused study", duration: "90 minutes" },
  { name: "Daily planning & review", duration: "10 minutes" }
];
const STORAGE_KEY = "deepWork30DayTracker_v1"; // unchanged so saved progress is kept
let state = null;
let selectedDate = null;
let calendarMonth = null;
let toastTimer;
const $ = (id) => document.getElementById(id);
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
    if (saved && saved.startDate && saved.records && saved.totalDays === TOTAL_DAYS) return saved;
  } catch (error) {
    console.warn("Could not read saved tracker data.", error);
  }
  return null;
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function getTodayIndex() { return dayDifference(state.startDate, localDateString(new Date())); }
function getElapsedDays() { return Math.max(0, Math.min(TOTAL_DAYS, getTodayIndex() + 1)); }
function getEndDate() { return localDateString(addDays(parseLocalDate(state.startDate), TOTAL_DAYS - 1)); }
function getRecord(date) { return state.records[date] || [false, false, false]; }
function countDone(date) { return getRecord(date).filter(Boolean).length; }
function getOverallStats() {
  const totalTicks = Object.values(state.records).reduce((sum, record) => sum + record.filter(Boolean).length, 0);
  const completion = (totalTicks / (TASKS.length * TOTAL_DAYS)) * 100;
  const elapsed = getElapsedDays();
  const perTask = TASKS.map((_, index) => {
    if (!elapsed) return { done: 0, pct: 0 };
    let done = 0;
    for (let i = 0; i < elapsed; i++) {
      const date = localDateString(addDays(parseLocalDate(state.startDate), i));
      if (getRecord(date)[index]) done++;
    }
    return { done, pct: (done / elapsed) * 100 };
  });
  const average = perTask.reduce((a, b) => a + b.pct, 0) / TASKS.length;
  const expected = TARGET_PERCENT * (elapsed / TOTAL_DAYS);
  return { totalTicks, completion, perTask, average, expected, elapsed };
}
function getStreak() {
  let cursor = Math.min(getTodayIndex(), TOTAL_DAYS - 1);
  if (cursor < 0) return 0;
  let streak = 0;
  const todayDate = localDateString(addDays(parseLocalDate(state.startDate), cursor));
  if (cursor === getTodayIndex() && countDone(todayDate) !== 3) cursor--;
  while (cursor >= 0) {
    const date = localDateString(addDays(parseLocalDate(state.startDate), cursor));
    if (countDone(date) !== 3) break;
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
  state = { startDate: date, totalDays: TOTAL_DAYS, targetPercent: TARGET_PERCENT, records: {} };
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

function toggleTask(index) {
  if (!selectedDate || !isChallengeDate(selectedDate) || isFuture(selectedDate)) return;
  const record = [...getRecord(selectedDate)];
  if (isPast(selectedDate)) {
    const msg = record[index] ? "Remove this completed mark?" : "Mark this missed task as completed?";
    if (!confirm(`${formatDate(selectedDate, { day: "numeric", month: "short" })}: ${msg}`)) return;
  }
  record[index] = !record[index];
  state.records[selectedDate] = record;
  saveState();
  render();
}
function renderSetup() {
  $("setupScreen").classList.toggle("hidden", !!state);
  $("tracker").classList.toggle("hidden", !state);
  if (!state) {
    $("setupHabits").innerHTML = TASKS.map((t, i) => `<li><span class="dot">${i + 1}</span><span>${t.name}</span><span>${t.duration}</span></li>`).join("");
    $("startDate").value = localDateString(new Date());
    $("startDate").min = localDateString(new Date());
  }
}
function renderDashboard() {
  const stats = getOverallStats();
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
    $("statusLine").textContent = n === 0 ? "You haven't checked off any habits yet" : n === 3 ? "All 3 done today" : `${n} of 3 done today`;
    $("dayValue").textContent = `${currentDay}/${TOTAL_DAYS}`;
  }
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
    if (inside && count === 1) classes += " partial-1";
    if (inside && count === 2) classes += " partial-2";
    if (inside && count === 3) classes += " complete";
    if (inside && isPast(date) && count === 0) classes += " missed";
    if (inside && future) classes += " future";
    if (date === selectedDate) classes += " selected";
    if (date === todayStr) classes += " today";
    const disabled = !inside || future ? "disabled" : "";
    cells.push(`<button class="${classes}" data-date="${date}" ${disabled} aria-label="${formatDate(date)}${inside ? `, ${count} of 3 completed` : ""}">${d.getDate()}</button>`);
  }
  $("calendarGrid").innerHTML = cells.join("");
  $("calendarGrid").querySelectorAll("[data-date]").forEach(button => {
    button.addEventListener("click", () => { selectedDate = button.dataset.date; render(); });
  });
}
function renderTaskPanel() {
  const date = selectedDate;
  const dayIndex = dayDifference(state.startDate, date);
  const record = getRecord(date);
  const count = record.filter(Boolean).length;
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
  $("taskList").innerHTML = TASKS.map((task, index) => {
    const done = record[index];
    const missed = past && !done;
    const stateText = done ? "Done" : missed ? "Missed" : "";
    const buttonClass = done ? "task-status done" : missed ? "task-status missed" : "task-status";
    const mark = done ? "✓" : missed ? "×" : "";
    const pt = stats.perTask[index];
    return `<div class="task-item ${done ? "done" : ""}">
      <button class="${buttonClass}" data-task="${index}" ${future ? "disabled" : ""} aria-label="${done ? "Unmark" : "Mark"} ${task.name}">${mark}</button>
      <div class="task-copy">
        <div class="task-top"><strong>${task.name}</strong><span class="task-state">${stateText}</span></div>
        <small>${task.duration} daily · ${pt.done} of ${stats.elapsed} days (${pt.pct.toFixed(0)}%)</small>
        <div class="mini-track"><span style="width:${pt.pct}%"></span></div>
      </div>
    </div>`;
  }).join("");
  $("taskList").querySelectorAll("[data-task]").forEach(button => button.addEventListener("click", () => toggleTask(Number(button.dataset.task))));
  $("dailySuccess").classList.toggle("hidden", count !== 3);
  $("challengeSuccess").classList.toggle("hidden", stats.totalTicks !== TASKS.length * TOTAL_DAYS);
}
function renderHistory() {
  const today = localDateString(new Date());
  $("historyBody").innerHTML = Array.from({ length: TOTAL_DAYS }, (_, index) => {
    const date = localDateString(addDays(parseLocalDate(state.startDate), index));
    const future = date > today;
    const record = getRecord(date);
    const dailyPercent = Math.round((record.filter(Boolean).length / 3) * 100);
    const cells = record.map(done => future ? '<td class="pending">—</td>' : `<td class="${done ? "yes" : "no"}">${done ? "✓" : "✗"}</td>`).join("");
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
}
function resetChallenge() {
  if (!confirm("Reset your entire 30-day challenge? All saved progress will be permanently cleared from this browser.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = null;
  selectedDate = null;
  calendarMonth = null;
  $("historyModal").classList.add("hidden");
  render();
}
$("startButton").addEventListener("click", () => startChallenge($("startDate").value));
$("startTodayButton").addEventListener("click", () => startChallenge(localDateString(new Date())));
$("resetButton").addEventListener("click", resetChallenge);
$("historyBtn").addEventListener("click", () => $("historyModal").classList.remove("hidden"));
$("closeHistory").addEventListener("click", () => $("historyModal").classList.add("hidden"));
$("modalBackdrop").addEventListener("click", () => $("historyModal").classList.add("hidden"));
$("prevMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); renderCalendar(); });
$("nextMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); renderCalendar(); });
document.addEventListener("keydown", event => {
  if (event.key === "Escape") $("historyModal").classList.add("hidden");
});
state = loadState();
if (state) {
  const today = localDateString(new Date());
  const end = getEndDate();
  selectedDate = today < state.startDate ? state.startDate : today > end ? end : today;
  const selected = parseLocalDate(selectedDate);
  calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
}
render();