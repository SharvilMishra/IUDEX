// ==========================================================================
// Shideep — Memories (MEM-001..007)
// ==========================================================================
import { h, escapeHTML, formatDate, debounce } from "../../js/utils.js";
import { skeletonList } from "../../components/loader.js";
import { openModal, confirmDialog } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import {
  subscribe, createDoc, updateDocById, deleteDocById, orderBy
} from "../../firebase/firestore.js";
import { auth } from "../../firebase/config.js";

let allMemories = [];

export async function render(container) {
  container.appendChild(
    h(`
      <div class="page">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h1>Memories</h1>
          <button class="btn btn--primary btn--icon" id="add-memory-btn" aria-label="Add memory">+</button>
        </div>
        <div class="field" style="margin-bottom:20px;">
          <input id="memory-search" type="text" placeholder="Search memories or tags…">
        </div>
        <div id="memory-list">${skeletonList(3, "height:140px; margin-bottom:16px;")}</div>
      </div>
    `)
  );

  const listEl = document.getElementById("memory-list");

  function renderList(memories) {
    if (!memories.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:32px;">🕰️</div>
          <p>No memories yet — add your first shared moment.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = memories
      .map(
        (m, i) => `
        <div class="card card--interactive stagger-item" style="--stagger-index:${i}; margin-bottom:16px;" data-id="${m.id}">
          ${m.photos?.[0] ? `<img src="${m.photos[0]}" alt="" style="width:100%; height:160px; object-fit:cover; border-radius:16px; margin-bottom:12px;">` : ""}
          <div class="eyebrow" style="margin-bottom:6px;">${formatDate(m.date, { month: "short", day: "numeric", year: "numeric" })}</div>
          <h3>${escapeHTML(m.title)}</h3>
          <p style="margin-top:6px;">${escapeHTML(m.description || "")}</p>
          ${m.tags?.length ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">${m.tags.map((t) => `<span class="eyebrow" style="background:var(--accent-primary-dim); color:var(--accent-primary); padding:4px 10px; border-radius:999px;">#${escapeHTML(t)}</span>`).join("")}</div>` : ""}
          <div style="display:flex; gap:8px; margin-top:12px; justify-content:flex-end;">
            <button class="btn btn--ghost" data-action="edit" style="padding:8px 16px; font-size:0.8rem;">Edit</button>
            <button class="btn btn--ghost" data-action="delete" style="padding:8px 16px; font-size:0.8rem; color:var(--danger);">Delete</button>
          </div>
        </div>`
      )
      .join("");

    listEl.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("[data-id]").dataset.id;
        openMemoryForm(memories.find((m) => m.id === id));
      });
    });
    listEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("[data-id]").dataset.id;
        confirmDialog("This memory will be removed for both of you.", {
          onConfirm: async () => {
            try {
              await deleteDocById("memories", id);
              showToast("Memory deleted", "info");
            } catch (err) {
              reportError(err, "deleting memory");
            }
          }
        });
      });
    });
  }

  // MEM-007: display chronologically (newest first)
  const unsubscribe = subscribe("memories", [orderBy("date", "desc")], (memories) => {
    allMemories = memories;
    renderList(memories);
  });

  // MEM-006: search memories (by title, description, or tag)
  const searchInput = document.getElementById("memory-search");
  searchInput.addEventListener(
    "input",
    debounce((e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) return renderList(allMemories);
      renderList(
        allMemories.filter(
          (m) =>
            m.title?.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q) ||
            m.tags?.some((t) => t.toLowerCase().includes(q))
        )
      );
    }, 200)
  );

  document.getElementById("add-memory-btn").addEventListener("click", () => openMemoryForm());

  return unsubscribe;
}

// MEM-001/002: create or edit a memory
function openMemoryForm(existing = null) {
  const close = openModal({
    title: existing ? "Edit memory" : "New memory",
    bodyHTML: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div class="field">
          <label for="mem-title">Title</label>
          <input id="mem-title" type="text" maxlength="80" value="${existing ? escapeHTML(existing.title) : ""}">
        </div>
        <div class="field">
          <label for="mem-date">Date</label>
          <input id="mem-date" type="date" value="${existing?.date ? new Date(existing.date.toDate ? existing.date.toDate() : existing.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="field">
          <label for="mem-description">Description</label>
          <textarea id="mem-description" rows="3" maxlength="500">${existing ? escapeHTML(existing.description || "") : ""}</textarea>
        </div>
        <div class="field">
          <label for="mem-tags">Tags (comma separated)</label>
          <input id="mem-tags" type="text" placeholder="travel, anniversary" value="${existing?.tags?.join(", ") || ""}">
        </div>
        <div class="field">
          <label for="mem-photo-url">Photo URL (optional)</label>
          <input id="mem-photo-url" type="url" placeholder="https://…" value="${existing?.photos?.[0] || ""}">
        </div>
      </div>
    `,
    actions: [
      { label: "Cancel", variant: "ghost" },
      {
        label: existing ? "Save" : "Add",
        variant: "primary",
        closeOnClick: false,
        onClick: async () => saveMemory(existing, close)
      }
    ]
  });

  async function saveMemory(existingMemory, closeFn) {
    const title = document.getElementById("mem-title").value.trim();
    const dateValue = document.getElementById("mem-date").value;
    const description = document.getElementById("mem-description").value.trim();
    const tags = document
      .getElementById("mem-tags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!title) {
      document.getElementById("mem-title").focus();
      return;
    }

    try {
      const photoUrl = document.getElementById("mem-photo-url").value.trim();
      const photos = photoUrl ? [photoUrl] : (existingMemory?.photos || []);

      const payload = { title, date: new Date(dateValue), description, tags, photos };

      if (existingMemory) {
        await updateDocById("memories", existingMemory.id, payload);
        showToast("Memory updated", "success");
      } else {
        await createDoc("memories", { ...payload, createdBy: auth.currentUser?.uid || null });
        showToast("Memory added", "success");
      }
      closeFn();
    } catch (err) {
      reportError(err, "saving memory");
    }
  }
}
