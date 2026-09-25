// ==========================================================================
// e-CON — Community
// Placeholder section. Intentionally just a destination for now — no
// community data model or backend exists yet.
// ==========================================================================
import { h } from "../../js/utils.js";

export async function render(container) {
  container.appendChild(h(`
    <div class="page">
      <div class="page-head">
        <h1>Community</h1>
      </div>
      <div class="empty-state">
        <div style="font-size:34px;">🌐</div>
        <h3 style="margin-bottom:6px;">Coming soon</h3>
        <p style="max-width:300px;">Community isn't built yet — this is just holding the spot in navigation.</p>
      </div>
    </div>
  `));

  return function teardown() {};
}
