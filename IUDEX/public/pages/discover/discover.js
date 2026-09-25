// ==========================================================================
// e-CON — Discover
// Browse everyone on e-CON, or jump straight to an exact @username.
// ==========================================================================
import { h, escapeHTML, debounce } from "../../js/utils.js";
import { skeletonList } from "../../components/loader.js";
import { avatarHTML } from "../../components/avatar.js";
import { navigate } from "../../js/router.js";
import { reportError } from "../../js/ui.js";
import { listUsers, searchUsersByUsername, isOnline } from "../../services/users.js";
import { normalizeUsername } from "../../services/usernames.js";

function userRowHTML(user) {
  return `
    <button class="user-row" data-username="${escapeHTML(user.username)}">
      ${avatarHTML(user, 46, { online: isOnline(user) })}
      <span class="user-row-body">
        <span class="user-row-name">${escapeHTML(user.name || user.username)}</span>
        <span class="user-row-handle">@${escapeHTML(user.username)}</span>
        ${user.bio ? `<span class="user-row-bio">${escapeHTML(user.bio)}</span>` : ""}
      </span>
      <span class="user-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

export async function render(container) {
  container.appendChild(h(`
    <div class="page">
      <div class="page-head">
        <h1>Discover</h1>
      </div>

      <div class="field search-field">
        <div class="input-affix input-affix--lead">
          <span class="input-affix-lead" aria-hidden="true">@</span>
          <input id="discover-search" type="search" placeholder="Search by username"
                 autocapitalize="none" autocorrect="off" spellcheck="false"
                 aria-label="Search by username">
        </div>
      </div>

      <div class="eyebrow" id="discover-label" style="margin:22px 0 12px;">People on e-CON</div>
      <div id="discover-results">${skeletonList(5, "height:64px; margin-bottom:10px;")}</div>
    </div>
  `));

  const input = document.getElementById("discover-search");
  const resultsEl = document.getElementById("discover-results");
  const labelEl = document.getElementById("discover-label");

  let searchToken = 0;
  let active = true;

  resultsEl.addEventListener("click", (e) => {
    const row = e.target.closest(".user-row");
    if (row) navigate("u", row.dataset.username);
  });

  function paint(users, emptyCopy) {
    if (!active) return;
    resultsEl.innerHTML = users.length
      ? users.map(userRowHTML).join("")
      : `<div class="empty-state"><div style="font-size:30px;">🔍</div><p style="max-width:300px;">${emptyCopy}</p></div>`;
  }

  async function loadDirectory() {
    labelEl.textContent = "People on e-CON";
    try {
      const users = await listUsers();
      paint(users, "No one else has joined yet. You're early.");
    } catch (err) {
      reportError(err, "loading the directory");
      paint([], "Couldn't load the directory right now.");
    }
  }

  /**
   * Prefix search runs server-side (see services/users.js), so it's one
   * query per keystroke burst rather than a full download filtered locally —
   * which matters the moment the directory is bigger than a few dozen people.
   */
  const runSearch = debounce(async (raw) => {
    const q = normalizeUsername(raw);
    const token = ++searchToken;

    if (!q) {
      resultsEl.innerHTML = skeletonList(4, "height:64px; margin-bottom:10px;");
      await loadDirectory();
      return;
    }

    labelEl.textContent = `Results for @${q}`;
    resultsEl.innerHTML = skeletonList(3, "height:64px; margin-bottom:10px;");

    try {
      const users = await searchUsersByUsername(q);
      if (token !== searchToken) return; // a newer search already ran
      paint(users, `No one matches @${escapeHTML(q)}.`);
    } catch (err) {
      if (token !== searchToken) return;
      reportError(err, "searching usernames");
      paint([], "Search failed. Try again in a moment.");
    }
  }, 280);

  input.addEventListener("input", (e) => runSearch(e.target.value));
  input.addEventListener("keydown", (e) => {
    // Enter on an exact handle goes straight to the profile — the fastest
    // path for someone who already knows who they're looking for.
    if (e.key !== "Enter") return;
    const q = normalizeUsername(input.value);
    if (q) navigate("u", q);
  });

  loadDirectory();

  return function teardown() {
    active = false;
    searchToken += 1;
  };
}
