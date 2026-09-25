// ==========================================================================
// e-CON — Group Chats
// Placeholder section. Intentionally just a destination for now — no
// group-conversation data model or backend exists yet.
// ==========================================================================
import { h } from "../../js/utils.js";

export async function render(container) {
  container.appendChild(h(`
    <div class="page">
      <div class="page-head">
        <h1>Group Chats</h1>
      </div>
      <div class="empty-state">
        <div style="font-size:34px;">👥</div>
        <h3 style="margin-bottom:6px;">Coming soon</h3>
        <p style="max-width:300px;">Group chats aren't built yet — this is just holding the spot in navigation.</p>
      </div>
    </div>
  `));

  return function teardown() {};
}
