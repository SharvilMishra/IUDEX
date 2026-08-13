// ==========================================================================
// Shideep — Loader Component
// ==========================================================================

export function loaderSpinner() {
  return `<div class="loader" role="status" aria-label="Loading"></div>`;
}

export function loaderScreen() {
  return `<div class="loader-screen">${loaderSpinner()}</div>`;
}

/** A single skeleton block; pass a height/width via style for cards, avatars, etc. */
export function skeleton(styleAttr = "height:80px;") {
  return `<div class="skeleton" style="${styleAttr}"></div>`;
}

export function skeletonList(count = 3, styleAttr = "height:64px; margin-bottom:12px;") {
  return Array.from({ length: count }, () => skeleton(styleAttr)).join("");
}
