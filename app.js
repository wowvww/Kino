// ===== Setup =====
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

let allEntries = [];
let activeStatus = "all";
let searchTerm = "";
let isSignUpMode = false;
let tmdbSearchTimer = null;

// ===== DOM refs =====
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authSubmit = document.getElementById("auth-submit");
const authToggle = document.getElementById("auth-toggle");

const entriesList = document.getElementById("entries-list");
const emptyState = document.getElementById("empty-state");
const statusFilter = document.getElementById("status-filter");
const searchOwnInput = document.getElementById("search-own");

const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const searchStep = document.getElementById("search-step");
const tmdbSearchInput = document.getElementById("tmdb-search");
const tmdbResultsEl = document.getElementById("tmdb-results");
const skipSearchBtn = document.getElementById("skip-search");
const entryForm = document.getElementById("entry-form");
const pickedSummary = document.getElementById("picked-summary");
const deleteBtn = document.getElementById("delete-entry");

// ===== Auth =====
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.hidden = true;
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  authSubmit.disabled = true;

  const { error } = isSignUpMode
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });

  authSubmit.disabled = false;

  if (error) {
    authError.textContent = error.message;
    authError.hidden = false;
    return;
  }
  if (isSignUpMode) {
    authError.textContent = "Акаунт створено. Якщо Supabase вимагає підтвердження пошти — перевір скриньку, тоді увійди.";
    authError.hidden = false;
    authError.style.color = "var(--watched)";
  }
});

authToggle.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  authSubmit.textContent = isSignUpMode ? "Створити акаунт" : "Увійти";
  authToggle.textContent = isSignUpMode ? "Вже є акаунт? Увійти" : "Немає акаунта? Створити";
  authError.hidden = true;
});

document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuthScreen();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showAppScreen();
    loadEntries();
  } else {
    showAuthScreen();
  }
});

function showAuthScreen() {
  authScreen.hidden = false;
  appScreen.hidden = true;
}
function showAppScreen() {
  authScreen.hidden = true;
  appScreen.hidden = false;
}

// ===== Load + render entries =====
async function loadEntries() {
  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  allEntries = data;
  renderEntries();
}

function renderEntries() {
  const filtered = allEntries.filter((e) => {
    const statusOk = activeStatus === "all" || e.status === activeStatus;
    const term = searchTerm.trim().toLowerCase();
    const searchOk = !term || e.title.toLowerCase().includes(term);
    return statusOk && searchOk;
  });

  entriesList.innerHTML = "";
  emptyState.hidden = allEntries.length > 0;
  if (allEntries.length > 0 && filtered.length === 0) {
    emptyState.hidden = false;
    emptyState.textContent = "Нічого не знайдено за цим фільтром.";
  } else if (allEntries.length > 0) {
    emptyState.textContent = "Поки що порожньо. Натисни «+ Додати», щоб внести перший фільм чи серіал.";
  }

  const statusLabels = { watching: "Дивлюся", watched: "Переглянуто", planned: "У планах" };

  for (const entry of filtered) {
    const li = document.createElement("li");
    li.className = "entry";

    const poster = document.createElement("img");
    poster.className = "entry-poster";
    poster.loading = "lazy";
    poster.src = entry.poster_path ? TMDB_IMG + entry.poster_path : "";
    poster.alt = "";
    if (!entry.poster_path) poster.style.visibility = "hidden";

    const perf = document.createElement("div");
    perf.className = "entry-perf";

    const body = document.createElement("div");
    body.className = "entry-body";

    const badge = document.createElement("span");
    badge.className = "status-badge " + entry.status;
    badge.textContent = statusLabels[entry.status] || entry.status;

    const top = document.createElement("div");
    top.className = "entry-top";

    const title = document.createElement("h3");
    title.className = "entry-title";
    title.textContent = entry.title;
    title.addEventListener("click", () => openEditModal(entry));

    top.appendChild(title);
    if (entry.rating !== null && entry.rating !== undefined) {
      const rating = document.createElement("span");
      rating.className = "entry-rating";
      rating.textContent = `${entry.rating}/10`;
      top.appendChild(rating);
    }

    const meta = document.createElement("p");
    meta.className = "entry-meta";
    const typeLabel = entry.media_type === "tv" ? "серіал" : "фільм";
    meta.textContent = [entry.year, typeLabel].filter(Boolean).join(" · ");

    body.appendChild(badge);
    body.appendChild(top);
    body.appendChild(meta);

    if (entry.notes) {
      const notes = document.createElement("p");
      notes.className = "entry-notes";
      notes.textContent = entry.notes;
      body.appendChild(notes);
    }

    li.appendChild(poster);
    li.appendChild(perf);
    li.appendChild(body);
    entriesList.appendChild(li);
  }
}

statusFilter.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  activeStatus = btn.dataset.status;
  renderEntries();
});

searchOwnInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderEntries();
});

// ===== Modal: add / edit =====
document.getElementById("open-add").addEventListener("click", () => openAddModal());
document.getElementById("modal-close").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

function openAddModal() {
  modalTitle.textContent = "Новий запис";
  entryForm.reset();
  entryForm.hidden = true;
  searchStep.hidden = false;
  tmdbSearchInput.value = "";
  tmdbResultsEl.innerHTML = "";
  pickedSummary.innerHTML = "";
  document.getElementById("entry-id").value = "";
  document.getElementById("entry-tmdb-id").value = "";
  document.getElementById("entry-poster").value = "";
  deleteBtn.hidden = true;
  modalBackdrop.hidden = false;
  tmdbSearchInput.focus();
}

function openEditModal(entry) {
  modalTitle.textContent = "Редагувати запис";
  searchStep.hidden = true;
  entryForm.hidden = false;
  pickedSummary.innerHTML = "";

  document.getElementById("entry-id").value = entry.id;
  document.getElementById("entry-tmdb-id").value = entry.tmdb_id || "";
  document.getElementById("entry-poster").value = entry.poster_path || "";
  document.getElementById("entry-title").value = entry.title;
  document.getElementById("entry-year").value = entry.year || "";
  document.getElementById("entry-type").value = entry.media_type || "movie";
  document.getElementById("entry-status").value = entry.status || "planned";
  document.getElementById("entry-rating").value = entry.rating ?? "";
  document.getElementById("entry-date").value = entry.watched_date || "";
  document.getElementById("entry-notes").value = entry.notes || "";

  deleteBtn.hidden = false;
  modalBackdrop.hidden = false;
}

function closeModal() {
  modalBackdrop.hidden = true;
}

skipSearchBtn.addEventListener("click", () => {
  searchStep.hidden = true;
  entryForm.hidden = false;
  document.getElementById("entry-title").focus();
});

// ===== TMDB search =====
tmdbSearchInput.addEventListener("input", () => {
  clearTimeout(tmdbSearchTimer);
  const q = tmdbSearchInput.value.trim();
  if (!q) {
    tmdbResultsEl.innerHTML = "";
    return;
  }
  tmdbSearchTimer = setTimeout(() => searchTMDB(q), 350);
});

async function searchTMDB(query) {
  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${CONFIG.TMDB_API_KEY}&language=uk-UA&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    const results = (data.results || []).filter((r) => r.media_type === "movie" || r.media_type === "tv").slice(0, 8);
    renderTMDBResults(results);
  } catch (err) {
    console.error("TMDB search failed", err);
  }
}

function renderTMDBResults(results) {
  tmdbResultsEl.innerHTML = "";
  for (const r of results) {
    const li = document.createElement("li");
    li.className = "tmdb-result";
    const title = r.title || r.name || "";
    const date = r.release_date || r.first_air_date || "";
    const year = date ? date.slice(0, 4) : "";

    const img = document.createElement("img");
    img.src = r.poster_path ? TMDB_IMG + r.poster_path : "";
    if (!r.poster_path) img.style.visibility = "hidden";

    const info = document.createElement("div");
    info.innerHTML = `<div class="tmdb-result-title">${escapeHtml(title)}</div><div class="tmdb-result-year">${year} · ${r.media_type === "tv" ? "серіал" : "фільм"}</div>`;

    li.appendChild(img);
    li.appendChild(info);
    li.addEventListener("click", () => pickTMDBResult(r, title, year));
    tmdbResultsEl.appendChild(li);
  }
}

function pickTMDBResult(r, title, year) {
  searchStep.hidden = true;
  entryForm.hidden = false;

  document.getElementById("entry-title").value = title;
  document.getElementById("entry-year").value = year;
  document.getElementById("entry-type").value = r.media_type;
  document.getElementById("entry-tmdb-id").value = r.id;
  document.getElementById("entry-poster").value = r.poster_path || "";

  pickedSummary.innerHTML = "";
  if (r.poster_path) {
    const img = document.createElement("img");
    img.src = TMDB_IMG + r.poster_path;
    pickedSummary.appendChild(img);
  }
  const span = document.createElement("span");
  span.textContent = `Обрано: ${title}${year ? " (" + year + ")" : ""}`;
  pickedSummary.appendChild(span);

  document.getElementById("entry-rating").focus();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===== Save / delete =====
entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const id = document.getElementById("entry-id").value;
  const ratingVal = document.getElementById("entry-rating").value;

  const payload = {
    user_id: user.id,
    title: document.getElementById("entry-title").value.trim(),
    year: document.getElementById("entry-year").value.trim() || null,
    media_type: document.getElementById("entry-type").value,
    status: document.getElementById("entry-status").value,
    rating: ratingVal === "" ? null : Number(ratingVal),
    watched_date: document.getElementById("entry-date").value || null,
    notes: document.getElementById("entry-notes").value.trim() || null,
    tmdb_id: document.getElementById("entry-tmdb-id").value || null,
    poster_path: document.getElementById("entry-poster").value || null
  };

  let error;
  if (id) {
    ({ error } = await supabase.from("diary_entries").update(payload).eq("id", id));
  } else {
    ({ error } = await supabase.from("diary_entries").insert(payload));
  }

  if (error) {
    alert("Не вдалося зберегти: " + error.message);
    return;
  }
  closeModal();
  loadEntries();
});

deleteBtn.addEventListener("click", async () => {
  const id = document.getElementById("entry-id").value;
  if (!id) return;
  if (!confirm("Видалити цей запис?")) return;
  const { error } = await supabase.from("diary_entries").delete().eq("id", id);
  if (error) {
    alert("Не вдалося видалити: " + error.message);
    return;
  }
  closeModal();
  loadEntries();
});

// ===== Init =====
(async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showAppScreen();
    loadEntries();
  } else {
    showAuthScreen();
  }
})();
