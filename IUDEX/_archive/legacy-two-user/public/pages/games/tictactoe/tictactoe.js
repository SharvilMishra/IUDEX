// ==========================================================================
// IUDEX — Tic Tac Toe (GAME-001..006)
// ==========================================================================
import { h } from "../../../js/utils.js";
import { reportError } from "../../../js/ui.js";
import { showToast } from "../../../components/toast.js";
import {
  getMyRole, subscribeGame, ensureGame, resetGame, updateGame, recordGameResult
} from "../../../js/gameSync.js";

const GAME_ID = "tictactoe";
const SYMBOL = { P1: "X", P2: "O" };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // "X" or "O"
    }
  }
  if (board.every((cell) => cell)) return "draw";
  return null;
}

function initialState() {
  return { board: Array(9).fill(null), turn: "P1", winner: null };
}

export async function render(container, { onBack } = {}) {
  const myRole = getMyRole();
  const mySymbol = SYMBOL[myRole];
  let resultRecorded = false;

  container.appendChild(
    h(`
      <div class="page">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <button class="btn btn--icon" id="back-btn" aria-label="Back to games">←</button>
          <h1 style="font-size:1.5rem;">Tic Tac Toe</h1>
        </div>
        <div id="ttt-status" class="text-secondary" style="margin-bottom:16px; text-align:center;"></div>
        <div id="ttt-board" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-width:320px; margin:0 auto;"></div>
        <div style="text-align:center; margin-top:20px;">
          <button class="btn btn--ghost" id="ttt-reset">New Game</button>
        </div>
      </div>
    `)
  );

  document.getElementById("back-btn").addEventListener("click", onBack);

  const boardEl = document.getElementById("ttt-board");
  const statusEl = document.getElementById("ttt-status");

  function renderBoard(state) {
    const { board, turn, winner } = state;
    boardEl.innerHTML = board
      .map(
        (cell, i) => `
        <button class="card" data-i="${i}" style="aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:700; color:${cell === "X" ? "var(--accent-primary)" : "var(--accent-highlight)"};" ${cell || winner ? "disabled" : ""}>
          ${cell || ""}
        </button>`
      )
      .join("");

    boardEl.querySelectorAll("[data-i]").forEach((btn) => {
      btn.addEventListener("click", () => handleMove(state, Number(btn.dataset.i)));
    });

    if (winner === "draw") {
      statusEl.textContent = "It's a draw!";
    } else if (winner) {
      const winnerRole = winner === SYMBOL.P1 ? "P1" : "P2";
      statusEl.textContent = winnerRole === myRole ? "You won! 🎉" : "They won this round.";
    } else {
      statusEl.textContent = turn === myRole ? "Your turn" : "Their turn…";
    }

    if (winner && !resultRecorded) {
      resultRecorded = true;
      const outcome = winner === "draw" ? "draw" : winner === SYMBOL.P1 ? "P1" : "P2";
      // Only the player who is "P1" commits the result, so it's written once
      // per finished game rather than twice (both clients see the same winner).
      if (myRole === "P1") {
        recordGameResult(GAME_ID, outcome).catch((err) => reportError(err, "recording result"));
      }
    }
  }

  async function handleMove(state, index) {
    if (state.board[index] || state.winner || state.turn !== myRole) return;
    const board = [...state.board];
    board[index] = mySymbol;
    const winner = checkWinner(board);
    try {
      await updateGame(GAME_ID, {
        board,
        winner,
        turn: winner ? state.turn : (state.turn === "P1" ? "P2" : "P1")
      });
    } catch (err) {
      reportError(err, "making move");
    }
  }

  document.getElementById("ttt-reset").addEventListener("click", async () => {
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
