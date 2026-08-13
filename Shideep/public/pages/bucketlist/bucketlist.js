// ==========================================================================
// Shideep — Bucket List (BKT-001..005)
// ==========================================================================
import { h, escapeHTML } from "../../js/utils.js";
import { skeletonList } from "../../components/loader.js";
import { confirmDialog, openModal, closeModal } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import {
  subscribe, createDoc, updateDocById, deleteDocById, orderBy
} from "../../firebase/firestore.js";
import { auth } from "../../firebase/config.js";

export async function render(container) {
  container.appendChild(
    h(`
      <div class="page">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h1>Bucket List</h1>
          <button class="btn btn--primary btn--icon" id="add-task-btn" aria-label="Add task">+</button>
        </div>
        <div id="task-list">${skeletonList(4)}</div>
      </div>
    `)
  );

  const listEl = document.getElementById("task-list");

  // BKT-005: real-time synchronization
  const unsubscribe = subscribe("bucketlist", [orderBy("createdAt", "desc")], (tasks) => {
    if (!tasks.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:32px;">🎯</div>
          <p>No goals yet. Add the first thing you want to do together.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = tasks
      .map(
        (t, i) => `
        <div class="card card--interactive stagger-item" style="--stagger-index:${i}; margin-bottom:12px; display:flex; align-items:center; gap:14px;" data-id="${t.id}">
          <button class="task-check" data-action="toggle" aria-label="${t.completed ? "Mark incomplete" : "Mark complete"}"
            style="width:26px; height:26px; border-radius:50%; border:2px solid ${t.completed ? "var(--success)" : "var(--border-strong)"}; background:${t.completed ? "var(--success)" : "transparent"}; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#0F172A; font-size:14px;">
            ${t.completed ? "✓" : ""}
          </button>
          <span style="flex:1; ${t.completed ? "text-decoration:line-through; color:var(--text-muted);" : ""}">${escapeHTML(t.title)}</span>
          <button class="btn btn--icon" data-action="delete" aria-label="Delete task" style="width:36px;height:36px;">🗑</button>
        </div>`
      )
      .join("");

    listEl.querySelectorAll("[data-action='toggle']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest("[data-id]").dataset.id;
        const task = tasks.find((t) => t.id === id);
        try {
          await updateDocById("bucketlist", id, { completed: !task.completed });
        } catch (err) {
          reportError(err, "updating task");
        }
      });
    });

    listEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("[data-id]").dataset.id;
        confirmDialog("This goal will be removed for both of you.", {
          onConfirm: async () => {
            try {
              await deleteDocById("bucketlist", id);
              showToast("Goal deleted", "info");
            } catch (err) {
              reportError(err, "deleting task");
            }
          }
        });
      });
    });
  });

  document.getElementById("add-task-btn").addEventListener("click", () => {
    openModal({
      title: "Add a goal",
      bodyHTML: `
        <div class="field">
          <label for="new-task-input">What do you want to do together?</label>
          <input id="new-task-input" type="text" placeholder="Watch a movie, learn something new…" maxlength="120">
        </div>
      `,
      actions: [
        { label: "Cancel", variant: "ghost" },
        {
          label: "Add",
          variant: "primary",
          closeOnClick: false,
          onClick: async () => {
            const input = document.getElementById("new-task-input");
            const title = input.value.trim();
            if (!title) {
              input.focus();
              return;
            }
            try {
              await createDoc("bucketlist", {
                title,
                completed: false,
                createdBy: auth.currentUser?.uid || null
              });
              showToast("Goal added", "success");
              closeModal();
            } catch (err) {
              reportError(err, "adding task");
            }
          }
        }
      ]
    });
    setTimeout(() => document.getElementById("new-task-input")?.focus(), 50);
  });

  return unsubscribe;
}
