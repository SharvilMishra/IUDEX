// ==========================================================================
// IUDEX — Connect Four (GAME-001..006)
// Board stored flat, 42 cells, row-major, 7 columns x 6 rows.
// index = row * 7 + col ; row 0 = top, row 5 = bottom.
// ==========================================================================
import { h } from "../../../js/utils.js";
import { reportError } from "../../../js/ui.js";
import { showToast } from "../../../components/toast.js";
import {
  getMyRole, subscribeGame, ensureGame, resetGame, updateGame, recordGameResult
} from "../../../js/gameSync.js";

const GAME_ID = "connect4";
const COLS = 7;
const ROWS = 6;
const DISC = { P1: "R", P2: "Y" };
const DISC_COLOR = { R: "#F87171", Y: "#FBBF24" };

function initialState() {
  return { board: Array(COLS * ROWS).fill(null), turn: "P1", winner: null };
}

function lowestEmptyRow(board, col) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (!board[row * COLS + col]) return row;
  }
  return -1;
}

function checkWinner(board) {
  const get = (r, c) => (r < 0 || r >= ROWS || c < 0 || c >= COLS ? null : board[r * COLS + c]);
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = get(r, c);
      if (!val) continue;
      for (const [dr, dc] of dirs) {
        if (
          get(r, c) === val &&
          get(r + dr, c + dc) === val &&
          get(r + dr * 2, c + dc * 2) === val &&
          get(r + dr * 3, c + dc * 3) === val
        ) {
          return val;
        }
      }
    }
  }
  if (board.every((cell) => cell)) return "draw";
  return null;
}

export async function render(container, { onBack } = {}) {
  const myRole = getMyRole();
  const myDisc = DISC[myRole];
  let resultRecorded = false;

  container.appendChild(
    h(`
      <div class="page">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <button class="btn btn--icon" id="back-btn" aria-label="Back to games">←</button>
          <h1 style="font-size:1.5rem;">Connect Four</h1>
        </div>
        <div id="c4-status" class="text-secondary" style="margin-bottom:16px; text-align:center;"></div>
        <div id="c4-board" style="display:grid; grid-template-columns:repeat(${COLS}, 1fr); gap:5px; background:var(--card); padding:8px; border-radius:16px; border:1px solid var(--border);"></div>
        <div style="text-align:center; margin-top:20px;">
          <button class="btn btn--ghost" id="c4-reset">New Game</button>
        </div>
      </div>
    `)
  );

  document.getElementById("back-btn").addEventListener("click", onBack);

  const boardEl = document.getElementById("c4-board");
  const statusEl = document.getElementById("c4-status");

  function renderBoard(state) {
    const { board, turn, winner } = state;
    boardEl.innerHTML = board
      .map((cell, i) => {
        const col = i % COLS;
        return `
        <button data-col="${col}" style="aspect-ratio:1; border-radius:50%; background:${cell ? DISC_COLOR[cell] : "rgba(255,255,255,0.06)"}; border:none;" ${winner ? "disabled" : ""}></button>`;
      })
      .join("");

    boardEl.querySelectorAll("[data-col]").forEach((btn) => {
      btn.addEventListener("click", () => handleDrop(state, Number(btn.dataset.col)));
    });

    if (winner === "draw") {
      statusEl.textContent = "It's a draw!";
    } else if (winner) {
      const winnerRole = winner === DISC.P1 ? "P1" : "P2";
      statusEl.textContent = winnerRole === myRole ? "You won! 🎉" : "They won this round.";
    } else {
      statusEl.textContent = turn === myRole ? "Your turn — pick a column" : "Their turn…";
    }

    if (winner && !resultRecorded) {
      resultRecorded = true;
      const outcome = winner === "draw" ? "draw" : winner === DISC.P1 ? "P1" : "P2";
      if (myRole === "P1") {
        recordGameResult(GAME_ID, outcome).catch((err) => reportError(err, "recording result"));
      }
    }
  }

  async function handleDrop(state, col) {
    if (state.winner || state.turn !== myRole) return;
    const row = lowestEmptyRow(state.board, col);
    if (row === -1) return; // column full
    const board = [...state.board];
    board[row * COLS + col] = myDisc;
    const winner = checkWinner(board);
    try {
      await updateGame(GAME_ID, {
        board,
        winner,
        turn: winner ? state.turn : (state.turn === "P1" ? "P2" : "P1")
      });
    } catch (err) {
      reportError(err, "dropping disc");
    }
  }

  document.getElementById("c4-reset").addEventListener("click", async () => {
    try {
      resultRecorded = false;
      await resetGame(GAME_ID, initialState());
      showToast("New game started", "info");
    } catch (err) {
      reportError(err, "starting new game");
    }
  });

  try {
    await ensureGame(GAME_ID, initialState());
  } catch (err) {
    reportError(err, "loading game");
  }

  const unsubscribe = subscribeGame(GAME_ID, (state) => {
    if (!state) return;
    renderBoard(state);
  });

  return unsubscribe;
}
