// ==========================================================================
// IUDEX — Rock Paper Scissors (GAME-001..006)
// Both players pick privately; once both have chosen, the round reveals
// and a winner is computed. Running score persists across rounds until
// "New Game" resets it.
// ==========================================================================
import { h } from "../../../js/utils.js";
import { reportError } from "../../../js/ui.js";
import {
  getMyRole, otherRole, subscribeGame, ensureGame, resetGame, updateGame, recordGameResult
} from "../../../js/gameSync.js";

const GAME_ID = "rps";
const CHOICES = [
  { id: "rock", emoji: "🪨", label: "Rock" },
  { id: "paper", emoji: "📄", label: "Paper" },
  { id: "scissors", emoji: "✂️", label: "Scissors" }
];
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

function initialState() {
  return { choices: { P1: null, P2: null }, revealed: false, roundWinner: null, scores: { P1: 0, P2: 0 } };
}

function decideRound(a, b) {
  if (a === b) return "draw";
  return BEATS[a] === b ? "P1v" : "P2v"; // resolved to role below
}

export async function render(container, { onBack } = {}) {
  const myRole = getMyRole();
  const opp = otherRole(myRole);
  let resolvingRound = false;

  container.appendChild(
    h(`
      <div class="page">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <button class="btn btn--icon" id="back-btn" aria-label="Back to games">←</button>
          <h1 style="font-size:1.5rem;">Rock Paper Scissors</h1>
        </div>
        <div id="rps-score" class="text-secondary" style="text-align:center; margin-bottom:20px; font-size:1.1rem;"></div>
        <div id="rps-status" class="text-secondary" style="text-align:center; margin-bottom:20px;"></div>
        <div id="rps-choices" style="display:flex; justify-content:center; gap:16px;"></div>
        <div style="text-align:center; margin-top:24px;">
          <button class="btn btn--ghost" id="rps-reset">New Game (reset score)</button>
        </div>
      </div>
    `)
  );

  document.getElementById("back-btn").addEventListener("click", onBack);

  const scoreEl = document.getElementById("rps-score");
  const statusEl = document.getElementById("rps-status");
  const choicesEl = document.getElementById("rps-choices");

  function renderChoices(state) {
    const myChoice = state.choices[myRole];
    choicesEl.innerHTML = CHOICES.map(
      (c) => `
      <button class="card card--interactive" data-choice="${c.id}" style="width:80px; height:90px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; ${myChoice === c.id ? "border-color:var(--accent-primary); border-width:2px;" : ""}" ${state.revealed ? "disabled" : ""}>
        <span style="font-size:28px;">${c.emoji}</span>
        <span class="eyebrow">${c.label}</span>
      </button>`
    ).join("");

    choicesEl.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.addEventListener("click", () => handleChoice(state, btn.dataset.choice));
    });
  }

  function renderState(state) {
    scoreEl.textContent = `You ${state.scores[myRole]} — ${state.scores[opp]} Them`;

    if (state.revealed) {
      const myPick = CHOICES.find((c) => c.id === state.choices[myRole]);
      const theirPick = CHOICES.find((c) => c.id === state.choices[opp]);
      const resultText =
        state.roundWinner === "draw"
          ? "Draw!"
          : state.roundWinner === myRole
          ? "You won this round! 🎉"
          : "They won this round.";
      statusEl.innerHTML = `You: ${myPick?.emoji || "?"} &nbsp;vs&nbsp; Them: ${theirPick?.emoji || "?"} <br><strong>${resultText}</strong>`;
    } else if (state.choices[myRole]) {
      statusEl.textContent = "Waiting for them to choose…";
    } else {
      statusEl.textContent = "Pick rock, paper, or scissors";
    }

    renderChoices(state);
  }

  async function handleChoice(state, choiceId) {
    if (state.revealed || state.choices[myRole]) return;
    try {
      await updateGame(GAME_ID, { [`choices.${myRole}`]: choiceId });
    } catch (err) {
      reportError(err, "making choice");
    }
  }

  document.getElementById("rps-reset").addEventListener("click", async () => {
    try {
      await resetGame(GAME_ID, initialState());
    } catch (err) {
      reportError(err, "resetting game");
    }
  });

  try {
    await ensureGame(GAME_ID, initialState());
  } catch (err) {
    reportError(err, "loading game");
  }

  const unsubscribe = subscribeGame(GAME_ID, async (state) => {
    if (!state) return;
    renderState(state);

    // Resolve the round once both picks are in — only P1's client commits
    // the resolution so it happens exactly once per round.
    const bothChosen = state.choices.P1 && state.choices.P2;
    if (bothChosen && !state.revealed && myRole === "P1" && !resolvingRound) {
      resolvingRound = true;
      const raw = decideRound(state.choices.P1, state.choices.P2);
      const roundWinner = raw === "draw" ? "draw" : raw === "P1v" ? "P1" : "P2";
      const scores = { ...state.scores };
      if (roundWinner !== "draw") scores[roundWinner] += 1;

      try {
        await updateGame(GAME_ID, { revealed: true, roundWinner, scores });
        await recordGameResult(GAME_ID, roundWinner);
      } catch (err) {
        reportError(err, "resolving round");
      }
    }

    // Reset the local guard once a new round begins (choices cleared).
    if (!state.choices.P1 && !state.choices.P2) {
      resolvingRound = false;
    }
  });

  // "Next round" is just picking again — clear choices after a short delay
  // once both are revealed, driven by whichever client sees it first.
  let autoAdvanceTimer = null;
  const unsubscribeAutoAdvance = subscribeGame(GAME_ID, (state) => {
    if (state?.revealed) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = setTimeout(() => {
        if (myRole === "P1") {
          updateGame(GAME_ID, { choices: { P1: null, P2: null }, revealed: false, roundWinner: null }).catch(() => {});
        }
      }, 2200);
    }
  });

  return function teardown() {
    unsubscribe();
    unsubscribeAutoAdvance();
    clearTimeout(autoAdvanceTimer);
  };
}
