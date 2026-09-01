// ==========================================================================
// IUDEX — Card Component
// ==========================================================================

/**
 * card({ eyebrow, title, body, footer, interactive })
 * Returns an HTML string — caller inserts into the DOM.
 */
export function card({ eyebrow = "", title = "", body = "", footer = "", interactive = false, className = "" } = {}) {
  return `
    <div class="card ${interactive ? "card--interactive" : ""} ${className}">
      ${eyebrow ? `<div class="eyebrow" style="margin-bottom:8px;">${eyebrow}</div>` : ""}
      ${title ? `<h3 style="margin-bottom:8px;">${title}</h3>` : ""}
      ${body ? `<div class="card-body">${body}</div>` : ""}
      ${footer ? `<div class="card-footer" style="margin-top:12px;">${footer}</div>` : ""}
    </div>
  `;
}
