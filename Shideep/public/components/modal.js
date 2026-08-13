// ==========================================================================
// Shideep — Modal Component
// ==========================================================================
import { h, qs } from "../js/utils.js";

let activeBackdrop = null;

/**
 * openModal({ title, bodyHTML, actions: [{label, variant, onClick}] })
 * Returns a close() function.
 */
export function openModal({ title = "", bodyHTML = "", actions = [] } = {}) {
  closeModal(); // only one at a time

  const actionsHTML = actions
    .map(
      (a, i) =>
        `<button class="btn ${a.variant === "danger" ? "btn--danger" : a.variant === "ghost" ? "btn--ghost" : "btn--primary"}" data-action-index="${i}">${a.label}</button>`
    )
    .join("");

  const backdrop = h(`
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
        ${title ? `<h3 style="margin-bottom:16px;">${title}</h3>` : ""}
        <div class="modal-body">${bodyHTML}</div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:24px;">
          ${actionsHTML}
        </div>
      </div>
    </div>
  `);

  actions.forEach((a, i) => {
    qs(`[data-action-index="${i}"]`, backdrop).addEventListener("click", () => {
      a.onClick?.();
      if (a.closeOnClick !== false) closeModal();
    });
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.body.appendChild(backdrop);
  activeBackdrop = backdrop;
  return closeModal;
}

export function closeModal() {
  if (activeBackdrop) {
    activeBackdrop.remove();
    activeBackdrop = null;
  }
}

/** Convenience helper for destructive-action confirmations. */
export function confirmDialog(message, { confirmLabel = "Delete", onConfirm }) {
  openModal({
    title: "Are you sure?",
    bodyHTML: `<p>${message}</p>`,
    actions: [
      { label: "Cancel", variant: "ghost" },
      { label: confirmLabel, variant: "danger", onClick: onConfirm }
    ]
  });
}
