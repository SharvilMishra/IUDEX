// ==========================================================================
// Shideep — Mood & Journal (MOOD-001..005)
// One check-in per person per day (doc id = date_uid, upsertable). The
// history feed below doubles as the "journal" — both people's notes,
// newest first, shared like everything else in Shideep.
// ==========================================================================
import { h, escapeHTML, timeAgo, todayKey } from "../../js/utils.js";
import { card } from "../../components/card.js";
import { skeletonList } from "../../components/loader.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import { subscribe, setDocById, deleteDocById, orderBy, limit, serverTimestamp } from "../../firebase/firestore.js";
import { auth, AUTHORIZED_EMAILS } from "../../firebase/config.js";

const MOODS = [
  { id: "great", emoji: "😄", label: "Great" },
  { id: "happy", emoji: "🙂", label: "Happy" },
  { id: "okay", emoji: "😐", label: "Okay" },
  { id: "low", emoji: "😔", label: "Low" },
  { id: "sleepy", emoji: "😴", label: "Sleepy" }
];
const MOOD_EMOJI = Object.fromEntries(MOODS.map((m) => [m.id, m.emoji]));

export async function render(container) {
  const user = auth.currentUser;
  const uid = user?.uid;
  const myName = (user?.displayName || "You").split(" ")[0];
  const todayDocId = `${todayKey()}_${uid}`;

  container.appendChild(
    h(`
      <div class="page">
        <h1 style="margin-bottom:20px;">Mood &amp; Journal</h1>

        <div class="card" style="margin-bottom:16px;">
          <div class="eyebrow" style="margin-bottom:12px;">How are you feeling today?</div>
          <div class="mood-picker" id="mood-picker">
            ${MOODS.map(
              (m) => `
              <button class="mood-option" data-mood="${m.id}" aria-label="${m.label}" type="button">
                <span class="mood-option-emoji">${m.emoji}</span>
                <span class="mood-option-label">${m.label}</span>
              </button>`
            ).join("")}
          </div>
          <div class="field" style="margin-top:16px;">
            <label for="mood-note">Journal (optional)</label>
            <textarea id="mood-note" rows="3" placeholder="Anything on your mind today…"></textarea>
          </div>
          <button class="btn btn--primary" id="mood-save-btn" style="margin-top:12px; width:100%;">Save today's check-in</button>
        </div>

        <div id="partner-mood-card" style="margin-bottom:24px;">${skeletonList(1, "height:70px;")}</div>

        <h3 style="margin-bottom:12px;">Journal history</h3>
        <div id="mood-history">${skeletonList(4, "height:78px; margin-bottom:10px;")}</div>
      </div>
    `)
  );

  const pickerEl = document.getElementById("mood-picker");
  const noteEl = document.getElementById("mood-note");
  const saveBtn = document.getElementById("mood-save-btn");
  const partnerEl = document.getElementById("partner-mood-card");
  const historyEl = document.getElementById("mood-history");

  let selectedMood = null;
  let allEntries = [];
  let prefilled = false;

  function selectMood(id) {
    selectedMood = id;
    pickerEl.querySelectorAll(".mood-option").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.mood === id);
    });
  }

  pickerEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".mood-option");
    if (btn) selectMood(btn.dataset.mood);
  });

  saveBtn.addEventListener("click", async () => {
    if (!selectedMood) {
      showToast("Pick a mood first.", "error");
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      await setDocById(
        "moods",
        todayDocId,
        {
          date: todayKey(),
          uid,
          email: user?.email || "",
          name: myName,
          mood: selectedMood,
          note: noteEl.value.trim(),
          createdAt: serverTimestamp()
        },
        true
      );
      showToast("Check-in saved 💙", "success");
    } catch (err) {
      reportError(err, "saving mood");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save today's check-in";
    }
  });

  function renderPartnerCard() {
    const myEmail = user?.email?.toLowerCase();
    const partnerEmail = AUTHORIZED_EMAILS.find((e) => e.toLowerCase() !== myEmail);
    const partnerToday = allEntries.find(
      (m) => m.date === todayKey() && m.email?.toLowerCase() === partnerEmail?.toLowerCase()
    );
    if (!partnerToday) {
      partnerEl.innerHTML = card({ eyebrow: "Their mood today", body: "Hasn't checked in yet." });
      return;
    }
    partnerEl.innerHTML = card({
      eyebrow: "Their mood today",
      body: `
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <span style="font-size:28px; line-height:1;">${MOOD_EMOJI[partnerToday.mood] || "🙂"}</span>
          <div>
            <div style="font-weight:600;">${escapeHTML(partnerToday.name || "Partner")}</div>
            ${partnerToday.note ? `<div class="text-muted" style="margin-top:2px;">${escapeHTML(partnerToday.note)}</div>` : ""}
          </div>
        </div>`
    });
  }

  function renderHistory() {
    if (!allEntries.length) {
      historyEl.innerHTML = `
        <div class="empty-state" style="padding:var(--space-8) var(--space-5);">
          <div style="font-size:28px;">📔</div>
          <p>No check-ins yet — be the first to share how you're feeling.</p>
        </div>`;
      return;
    }
    historyEl.innerHTML = allEntries
      .map(
        (m, i) => `
        <div class="card mood-entry stagger-item" style="--stagger-index:${i};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:22px;">${MOOD_EMOJI[m.mood] || "🙂"}</span>
              <div>
                <div style="font-weight:600;">${escapeHTML(m.name || "—")}</div>
                <div class="text-xs text-muted">${timeAgo(m.createdAt)}</div>
              </div>
            </div>
            ${m.uid === uid ? `<button class="btn btn--icon" data-id="${m.id}" data-action="delete" aria-label="Delete" style="width:32px;height:32px;">✕</button>` : ""}
          </div>
          ${m.note ? `<p style="margin-top:10px; white-space:pre-wrap;">${escapeHTML(m.note)}</p>` : ""}
        </div>`
      )
      .join("");

    historyEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteDocById("moods", btn.dataset.id).catch((err) => reportError(err, "deleting entry"));
      });
    });
  }

  const unsub = subscribe("moods", [orderBy("createdAt", "desc"), limit(60)], (docs) => {
    allEntries = docs;
    if (!prefilled) {
      const mine = docs.find((m) => m.id === todayDocId);
      if (mine) {
        selectMood(mine.mood);
        noteEl.value = mine.note || "";
      }
      prefilled = true;
    }
    renderPartnerCard();
    renderHistory();
  });

  return function teardown() {
    unsub?.();
  };
}
