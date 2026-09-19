// ==========================================================================
// IUDEX — Games Hub (GAME-001..006 common requirements)
// Acts as a lightweight internal router within the /games route: picking a
// game swaps the view in place (no hash change).
// ==========================================================================
import { h } from "../../js/utils.js";
import { card } from "../../components/card.js";

const GAMES = [
  { id: "tictactoe", title: "Tic Tac Toe", emoji: "⭕", loader: () => import("./tictactoe/tictactoe.js") },
  { id: "connect4", title: "Connect Four", emoji: "🔴", loader: () => import("./connect4/connect4.js") },
  { id: "rps", title: "Rock Paper Scissors", emoji: "✊", loader: () => import("./rps/rps.js") }
];

export async function render(container) {
  let activeTeardown = null;
  const root = h(`<div></div>`);
  container.appendChild(root);

  function showHub() {
    if (activeTeardown) {
      activeTeardown();
      activeTeardown = null;
    }
    root.innerHTML = `
      <div class="page">
        <h1 style="margin-bottom:20px;">Games</h1>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${GAMES.map(
            (g, i) => `
            <button class="stagger-item" style="--stagger-index:${i}; text-align:left; width:100%;" data-game="${g.id}">
              ${card({
                title: `${g.emoji}  ${g.title}`,
                body: `<span class="text-muted">Tap to play — synced live for both of you.</span>`,
                interactive: true
              })}
            </button>`
          ).join("")}
        </div>
        <p class="text-muted" style="margin-top:20px; font-size:0.85rem;">More games (Snake, Pong, 2048, and others) are coming in a later phase.</p>
      </div>
    `;
    root.querySelectorAll("[data-game]").forEach((btn) => {
      btn.addEventListener("click", () => loadGame(btn.dataset.game));
    });
  }

  async function loadGame(gameId) {
    const gameDef = GAMES.find((g) => g.id === gameId);
    if (!gameDef) return;
    root.innerHTML = "";
    const mod = await gameDef.loader();
    activeTeardown = await mod.render(root, { onBack: showHub });
  }

  showHub();

  return function teardown() {
    if (activeTeardown) activeTeardown();
  };
}
