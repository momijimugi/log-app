const STORAGE_KEY = "log-glass-data";
const BACKUP_KEY = "log-glass-last-backup";
const DEFAULT_SUBCATEGORY = "未分類";
const form = document.getElementById("logForm");
const categoriesEl = document.getElementById("categories");
const statsEl = document.getElementById("pillStats");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const searchInput = document.getElementById("search");
const categoryFilterSelect = document.getElementById("categoryFilter");
const subcategoryFilterSelect = document.getElementById("subcategoryFilter");
const dateFilterSelect = document.getElementById("dateFilter");
const sortOrderSelect = document.getElementById("sortOrder");
const demoBtn = document.getElementById("demoFill");
const clearBtn = document.getElementById("clearAll");
const exportBtn = document.getElementById("exportJson");
const importBtn = document.getElementById("importJsonBtn");
const importFileInput = document.getElementById("importJsonFile");
const settingsToggle = document.getElementById("settingsToggle");
const settingsMenu = document.getElementById("settingsMenu");
const backupInfoEl = document.getElementById("backupInfo");
const categoryOptions = document.getElementById("categoryOptions");
const subcategoryOptions = document.getElementById("subcategoryOptions");
const noteEditor = document.getElementById("noteRich");
const noteToolbar = document.querySelector(".note-toolbar");
const editIndicator = document.getElementById("editIndicator");
const editLabel = document.getElementById("editLabel");
const cancelEditBtn = document.getElementById("cancelEdit");
const submitBtn = form.querySelector('button[type="submit"]');
const autosizeFields = document.querySelectorAll(".autosize");
const defaultSubmitLabel = submitBtn.textContent;
let editTarget = null;
let lastBackup = null;

const state = { categories: [] };

const sampleData = {
  categories: [
    {
      name: "仕事",
      subcategories: [
        {
          name: "ミーティング",
          logs: [
            { date: "2024-04-11", time: "10:00", title: "チーム定例でOKRを再整理", note: "優先度Aを3つに絞り込んだ。サマリーをSlackに展開。" },
            { date: "2024-04-10", time: "15:30", title: "顧客ヒアリング (Beta社)", note: "導入後の利用頻度が安定。次回は料金プランの話を詰める。" }
          ]
        },
        {
          name: "執筆",
          logs: [
            { date: "2024-04-09", time: "08:45", title: "プロダクトアップデートのリリースノート下書き", note: "スクショ差し替え要。CTA文言はもう少しライトに。" }
          ]
        }
      ]
    },
    {
      name: "ライフ",
      subcategories: [
        {
          name: "運動",
          logs: [
            { date: "2024-04-11", time: "07:10", title: "朝ラン 5km / 29:40", note: "坂道ペース配分良し。夜はストレッチ追加。" }
          ]
        },
        {
          name: "読書",
          logs: [
            { date: "2024-04-08", time: "22:10", title: "『エッセンシャル思考』2章", note: "トレードオフのメモを次の1on1で使う。" }
          ]
        }
      ]
    },
    {
      name: "趣味",
      subcategories: [
        {
          name: "音楽",
          logs: [
            { date: "2024-04-10", time: "21:00", title: "新曲ラフを8小節だけ", note: "シンセのパッドはJuno系に変更。" }
          ]
        }
      ]
    }
  ]
};

function init() {
  loadState();
  loadBackup();
  setDefaultDateTime();
  render();
  form.addEventListener("submit", onSubmit);
  searchInput.addEventListener("input", render);
  categoryFilterSelect.addEventListener("change", render);
  subcategoryFilterSelect.addEventListener("change", render);
  dateFilterSelect.addEventListener("change", render);
  sortOrderSelect.addEventListener("change", render);
  exportBtn.addEventListener("click", exportJson);
  importBtn.addEventListener("click", () => importFileInput.click());
  importFileInput.addEventListener("change", handleImportFile);
  settingsToggle.addEventListener("click", toggleSettingsMenu);
  cancelEditBtn.addEventListener("click", () => {
    clearEditState();
    form.reset();
    setDefaultDateTime();
    autosizeAll();
  });
  setupAutosize();
  demoBtn.addEventListener("click", () => {
    state.categories = clone(sampleData.categories);
    saveState();
    render();
    closeAllMenus();
  });
  clearBtn.addEventListener("click", () => {
    const first = confirm("本当にすべてのログを消しますか？");
    if (!first) return;
    const second = confirm("最終確認: すべてのログが消去されます。続行しますか？");
    if (!second) return;
    state.categories = [];
    saveState();
    render();
    closeAllMenus();
  });
  exportBtn.addEventListener("click", closeAllMenus);
  importBtn.addEventListener("click", closeAllMenus);
  if (noteToolbar) {
    noteToolbar.addEventListener("click", handleNoteCommand);
  }
  window.addEventListener("keydown", handleKeySave);
  window.addEventListener("keydown", handleShiftEnterSubmit);
  document.addEventListener("click", handleGlobalClick);
}

function setDefaultDateTime() {
  const now = new Date();
  dateInput.value = now.toISOString().slice(0, 10);
  timeInput.value = now.toTimeString().slice(0, 5);
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
      ensureIds();
      return;
    }
  } catch (err) {
    console.warn("Failed to read storage", err);
  }
  state.categories = [];
}

function loadBackup() {
  try {
    const saved = localStorage.getItem(BACKUP_KEY);
    if (saved) lastBackup = saved;
  } catch (err) {
    console.warn("Failed to read backup timestamp", err);
  }
}

function updateDatalists() {
  if (!categoryOptions || !subcategoryOptions) return;
  const cats = [...new Set(state.categories.map((c) => c.name).filter(Boolean))];
  const subs = [
    ...new Set(
      state.categories
        .flatMap((c) => c.subcategories || [])
        .map((s) => s.name)
        .filter(Boolean)
    )
  ];
  categoryOptions.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
  subcategoryOptions.innerHTML = subs.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("");
}

function ensureIds() {
  state.categories.forEach((cat) => {
    cat.id = cat.id || uid();
    cat.name = (cat.name || "").trim() || "カテゴリ";
    cat.subcategories = cat.subcategories || [];
    cat.subcategories.forEach((sub) => {
      sub.id = sub.id || uid();
      sub.name = normalizeSubcategory(sub.name);
      sub.logs = sub.logs || [];
      sub.logs.forEach((log) => {
        log.id = log.id || uid();
        log.createdAt = log.createdAt || new Date().toISOString();
      });
    });
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function onSubmit(e) {
  e.preventDefault();
  const isEditing = Boolean(editTarget);
  const existing = isEditing ? getLogByTarget(editTarget) : null;
  const log = {
    id: existing?.log?.id || uid(),
    date: dateInput.value,
    time: timeInput.value,
    title: document.getElementById("title").value.trim(),
    noteHtml: sanitizeNote(noteEditor.innerHTML),
    createdAt: existing?.log?.createdAt || new Date().toISOString()
  };
  const catName = document.getElementById("category").value.trim();
  const subName = normalizeSubcategory(document.getElementById("subcategory").value);
  if (!log.title || !catName) return;

  if (isEditing && existing?.sub) {
    existing.sub.logs = existing.sub.logs.filter((l) => l.id !== log.id);
  }

  const sub = ensureSubcategory(catName, subName);
  sub.logs.push(log);
  saveState();
  render();
  form.reset();
  setDefaultDateTime();
  clearEditState();
  resetNoteEditor();
  autosizeAll();
}

function ensureSubcategory(catName, subName) {
  const safeCatName = (catName || "").trim() || "カテゴリ";
  const safeSubName = normalizeSubcategory(subName);

  let cat = state.categories.find((c) => same(c.name, safeCatName));
  if (!cat) {
    cat = { id: uid(), name: safeCatName, subcategories: [] };
    state.categories.push(cat);
  }
  let sub = cat.subcategories.find((s) => same(s.name, safeSubName));
  if (!sub) {
    sub = { id: uid(), name: safeSubName, logs: [] };
    cat.subcategories.push(sub);
  }
  return sub;
}

function render() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const dateFilter = dateFilterSelect.value;
  const catFilter = categoryFilterSelect.value;
  const subFilter = subcategoryFilterSelect.value;
  const sortOrder = sortOrderSelect.value;

  const counts = countLogs();
  statsEl.innerHTML = `<span>カテゴリ: ${state.categories.length}</span><span>ログ: ${counts}</span>`;
  updateBackupInfo();
  updateDatalists();
  updateFilterOptions();

  const sortedCats = [...state.categories].sort((a, b) => totalLogs(b) - totalLogs(a));
  categoriesEl.innerHTML = "";

  let rendered = 0;
  sortedCats.forEach((cat) => {
    const catTotal = totalLogs(cat);
    if (catFilter !== "all" && catFilter !== cat.name) return;
    const subFiltered = cat.subcategories.map((sub) => {
      if (subFilter !== "all" && sub.name !== subFilter) return { ...sub, logs: [] };
      const logs = sub.logs
        .filter((log) => matchesSearch(log, searchTerm))
        .filter((log) => matchesDate(log, dateFilter))
        .sort((a, b) => sortLogs(a, b, sortOrder));
      return { ...sub, logs };
    });

    const hasLogs = subFiltered.some((s) => s.logs.length > 0);
    if (!hasLogs) return;
    rendered++;

    const card = document.createElement("article");
    card.className = "category-card";
    card.innerHTML = `
      <div class="category-header">
        <div class="category-title">
          <div class="tag" style="border-color:${color(cat.name)}; background: ${color(cat.name, 0.12)}; color:${color(cat.name, 0.9)}">${cat.name}</div>
          <div class="counts">サブ: ${cat.subcategories.length} / ログ: ${catTotal}</div>
        </div>
      </div>
    `;

    subFiltered.forEach((sub) => {
      if (!sub.logs.length) return;
      const box = document.createElement("div");
      box.className = "subcategory";
      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.innerHTML = `
        <span>${sub.name}</span>
        <span class="counts">${sub.logs.length} 件</span>
      `;
      const list = document.createElement("div");
      list.className = "logs";

      sub.logs.forEach((log) => {
        const logEl = document.createElement("div");
        logEl.className = "log";
        const noteExists = hasNote(log);
        logEl.innerHTML = `
          <header>
            <div class="log-top">
              <span class="dot" style="background:${color(cat.name)}; box-shadow: 0 0 0 4px ${color(cat.name, 0.2)}"></span>
              <time>${formatDate(log.date)} / ${log.time}</time>
            </div>
            <div class="log-actions">
              ${noteExists ? `<button class="mini ghost note-toggle" aria-label="メモ表示" title="メモ表示">👀</button>` : ""}
              <div class="log-menu-wrap">
                <button class="mini ghost icon-btn menu-toggle" aria-label="メニュー">⋯</button>
                <div class="log-menu hidden">
                  <button class="menu-item edit-item">編集</button>
                  <button class="menu-item danger delete-item">消去</button>
                </div>
              </div>
            </div>
          </header>
          <p class="log-title">${escapeHtml(log.title)}</p>
          ${noteExists ? `<div class="note hidden"></div>` : ""}
          <div class="meta">
            <span class="pill">${sub.name}</span>
            <span class="pill">${cat.name}</span>
            <span class="pill">${timeAgo(log.date, log.time)}</span>
        </div>
      `;
        const noteEl = logEl.querySelector(".note");
        if (noteExists && noteEl) {
          const safeNote = renderNoteHtml(log);
          noteEl.innerHTML = safeNote;
        }
        const menuToggle = logEl.querySelector(".menu-toggle");
        const menuEl = logEl.querySelector(".log-menu");
        const editItem = logEl.querySelector(".edit-item");
        const deleteItem = logEl.querySelector(".delete-item");
        if (menuToggle && menuEl) {
          menuToggle.addEventListener("click", (ev) => {
            ev.stopPropagation();
            closeAllLogMenus();
            menuEl.classList.toggle("hidden");
          });
        }
        if (editItem) editItem.addEventListener("click", () => { closeAllLogMenus(); startEdit(log, cat, sub); });
        if (deleteItem) deleteItem.addEventListener("click", () => { closeAllLogMenus(); deleteLog(cat.id, sub.id, log.id); });
        const noteButton = logEl.querySelector(".note-toggle");
        if (noteButton && noteEl) {
          noteButton.addEventListener("click", () => {
            const hidden = noteEl.classList.toggle("hidden");
            const label = hidden ? "メモ表示" : "メモ非表示";
            noteButton.textContent = hidden ? "👀" : "🙈";
            noteButton.setAttribute("aria-label", label);
            noteButton.setAttribute("title", label);
          });
        }
        list.appendChild(logEl);
      });

      details.appendChild(summary);
      details.appendChild(list);
      box.appendChild(details);
      card.appendChild(box);
    });

    categoriesEl.appendChild(card);
  });

  if (!rendered) {
    categoriesEl.innerHTML = `<div class="empty">まだ表示できるログがありません。上で追加するか、デモデータを読み込んでください。</div>`;
  }
}

function startEdit(log, cat, sub) {
  editTarget = { catId: cat.id, subId: sub.id, logId: log.id };
  document.getElementById("category").value = cat.name;
  document.getElementById("subcategory").value = sub.name === DEFAULT_SUBCATEGORY ? "" : sub.name;
  document.getElementById("title").value = log.title;
  if (noteEditor) {
    noteEditor.innerHTML = renderNoteHtml(log, { forEdit: true });
  }
  dateInput.value = log.date;
  timeInput.value = log.time;
  autosizeAll();
  updateEditUI(log.title);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateEditUI(title) {
  editIndicator.classList.remove("hidden");
  editLabel.textContent = `編集中: ${title || "無題"}`;
  submitBtn.textContent = "更新";
}

function clearEditState() {
  editTarget = null;
  editIndicator.classList.add("hidden");
  editLabel.textContent = "";
  submitBtn.textContent = defaultSubmitLabel;
}

function toggleSettingsMenu(ev) {
  ev.stopPropagation();
  const isHidden = settingsMenu.classList.contains("hidden");
  closeAllMenus();
  if (isHidden) settingsMenu.classList.remove("hidden");
}

function closeAllMenus() {
  settingsMenu.classList.add("hidden");
  closeAllLogMenus();
}

function exportJson() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `log-glass-${fileTimestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  markBackup();
}

function handleImportFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.categories)) throw new Error("categories が見つかりませんでした");
      state.categories = parsed.categories;
      ensureIds();
      saveState();
      render();
      alert("JSONを読み込みました");
    } catch (err) {
      console.error("Failed to import JSON", err);
      alert("読み込みに失敗しました: " + err.message);
    } finally {
      importFileInput.value = "";
    }
  };
  reader.readAsText(file);
}

function matchesSearch(log, term) {
  if (!term) return true;
  const noteText = getNoteText(log).toLowerCase();
  return (
    log.title.toLowerCase().includes(term) ||
    noteText.includes(term)
  );
}

function matchesDate(log, filter) {
  if (filter === "all") return true;
  const today = new Date();
  const logDate = toDate(log.date, log.time);
  if (filter === "today") {
    return isSameDay(today, logDate);
  }
  if (filter === "week") {
    const diff = (today - logDate) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  }
  if (filter === "month") {
    return today.getMonth() === logDate.getMonth() && today.getFullYear() === logDate.getFullYear();
  }
  return true;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(str) {
  const [y, m, d] = str.split("-");
  return `${m}/${d}`;
}

function toDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr || "00:00"}:00`);
}

function totalLogs(cat) {
  return cat.subcategories.reduce((sum, sub) => sum + (sub.logs?.length || 0), 0);
}

function countLogs() {
  return state.categories.reduce((sum, cat) => sum + totalLogs(cat), 0);
}

function timeAgo(dateStr, timeStr) {
  const target = toDate(dateStr, timeStr);
  const diffMs = Date.now() - target.getTime();
  if (diffMs < 0) return "これから";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}週前`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}か月前`;
}

function color(name, opacity = 0.8) {
  const hue = name.split("").reduce((sum, char, idx) => sum + char.charCodeAt(0) * (idx + 3), 0) % 360;
  return `hsla(${hue}, 80%, 70%, ${opacity})`;
}

function sortLogs(a, b, order) {
  if (order === "date_asc") return toDate(a.date, a.time) - toDate(b.date, b.time);
  if (order === "title_asc") return a.title.localeCompare(b.title, "ja");
  if (order === "title_desc") return b.title.localeCompare(a.title, "ja");
  return toDate(b.date, b.time) - toDate(a.date, a.time);
}

function same(a, b) {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

function normalizeSubcategory(name) {
  const trimmed = (name || "").trim();
  return trimmed || DEFAULT_SUBCATEGORY;
}

function getLogByTarget(target) {
  if (!target) return null;
  const cat = state.categories.find((c) => c.id === target.catId);
  if (!cat) return null;
  const sub = cat.subcategories.find((s) => s.id === target.subId);
  if (!sub) return null;
  const log = sub.logs.find((l) => l.id === target.logId);
  if (!log) return null;
  return { cat, sub, log };
}

function deleteLog(catId, subId, logId) {
  const cat = state.categories.find((c) => c.id === catId);
  if (!cat) return;
  const sub = cat.subcategories.find((s) => s.id === subId);
  if (!sub) return;
  sub.logs = sub.logs.filter((l) => l.id !== logId);
  if (sub.logs.length === 0) {
    cat.subcategories = cat.subcategories.filter((s) => s.id !== subId);
  }
  if (cat.subcategories.length === 0) {
    state.categories = state.categories.filter((c) => c.id !== catId);
  }
  saveState();
  render();
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(16).slice(2);
}

function clone(val) {
  return JSON.parse(JSON.stringify(val));
}

function fileTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderNoteHtml(log, { forEdit = false } = {}) {
  const raw = log.noteHtml || log.note || "";
  if (!raw) return "";
  if (log.noteHtml) {
    return sanitizeNote(raw, { allowBr: true });
  }
  const escaped = escapeHtml(raw).replace(/\r?\n/g, "<br>");
  return forEdit ? escaped : escaped;
}

function getNoteText(log) {
  if (!log) return "";
  const raw = log.noteHtml ? sanitizeNote(log.noteHtml, { allowBr: true }) : log.note || "";
  const temp = document.createElement("div");
  temp.innerHTML = raw;
  return temp.textContent || "";
}

function hasNote(log) {
  return getNoteText(log).trim().length > 0;
}

function sanitizeNote(html, { allowBr = false } = {}) {
  const temp = document.createElement("div");
  temp.innerHTML = html || "";
  const disallowed = ["script", "style", "iframe"];
  temp.querySelectorAll(disallowed.join(",")).forEach((el) => el.remove());
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_ELEMENT, null);
  while (walker.nextNode()) {
    const el = walker.currentNode;
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith("on")) el.removeAttribute(attr.name);
      if (["style"].includes(attr.name)) el.removeAttribute(attr.name);
    });
    if (!allowBr && el.tagName.toLowerCase() === "br") {
      el.replaceWith(document.createTextNode("\n"));
    }
  }
  return temp.innerHTML.trim();
}

function handleNoteCommand(e) {
  const btn = e.target.closest("button[data-cmd]");
  if (!btn) return;
  const cmd = btn.dataset.cmd;
  const value = btn.dataset.value || null;
  if (cmd === "formatBlock" && value) {
    document.execCommand("formatBlock", false, value);
  } else {
    document.execCommand(cmd, false, value);
  }
  noteEditor.focus();
}

function resetNoteEditor() {
  if (noteEditor) {
    noteEditor.innerHTML = "";
  }
}

function markBackup() {
  const ts = new Date().toISOString();
  lastBackup = ts;
  try {
    localStorage.setItem(BACKUP_KEY, ts);
  } catch (err) {
    console.warn("Failed to save backup timestamp", err);
  }
  updateBackupInfo();
}

function updateBackupInfo() {
  if (!backupInfoEl) return;
  if (!lastBackup) {
    backupInfoEl.textContent = "最終バックアップ: なし";
    backupInfoEl.classList.remove("old");
    return;
  }
  const dt = new Date(lastBackup);
  if (Number.isNaN(dt.getTime())) {
    backupInfoEl.textContent = "最終バックアップ: 不明";
    backupInfoEl.classList.add("old");
    return;
  }
  const ageDays = (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24);
  const isOld = ageDays > 1;
  backupInfoEl.textContent = `最終バックアップ: ${formatDateTime(dt)}`;
  backupInfoEl.classList.toggle("old", isOld);
}

function updateFilterOptions() {
  if (!categoryFilterSelect || !subcategoryFilterSelect) return;
  const cats = [...new Set(state.categories.map((c) => c.name).filter(Boolean))];
  const subs = [
    ...new Set(
      state.categories
        .flatMap((c) => c.subcategories || [])
        .map((s) => s.name)
        .filter(Boolean)
    )
  ];
  const catValue = categoryFilterSelect.value;
  const subValue = subcategoryFilterSelect.value;
  categoryFilterSelect.innerHTML = `<option value="all">全カテゴリ</option>` + cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  subcategoryFilterSelect.innerHTML = `<option value="all">全サブカテゴリ</option>` + subs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  if (cats.includes(catValue)) categoryFilterSelect.value = catValue;
  if (subs.includes(subValue)) subcategoryFilterSelect.value = subValue;
}

function handleKeySave(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    exportJson();
    closeAllMenus();
  }
}

function handleShiftEnterSubmit(e) {
  if (e.shiftKey && e.key === "Enter") {
    e.preventDefault();
    form.requestSubmit();
  }
}

function setupAutosize() {
  autosizeFields.forEach((el) => {
    autoResize(el);
    el.addEventListener("input", () => autoResize(el));
  });
}

function autosizeAll() {
  autosizeFields.forEach((el) => autoResize(el));
}

function autoResize(el) {
  const minRows = parseInt(el.dataset.minRows || el.getAttribute("rows") || "1", 10);
  const styles = getComputedStyle(el);
  const lineHeight = parseInt(styles.lineHeight, 10) || 20;
  const padding = parseInt(styles.paddingTop, 10) + parseInt(styles.paddingBottom, 10);
  const border = parseInt(styles.borderTopWidth, 10) + parseInt(styles.borderBottomWidth, 10);
  const minHeight = lineHeight * minRows + padding + border;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

function closeAllLogMenus() {
  document.querySelectorAll(".log-menu").forEach((menu) => menu.classList.add("hidden"));
}

function handleGlobalClick(ev) {
  if (!settingsMenu.contains(ev.target) && ev.target !== settingsToggle) {
    settingsMenu.classList.add("hidden");
  }
  if (!ev.target.closest(".log-menu-wrap")) {
    closeAllLogMenus();
  }
}

init();
