// ==========================================================================
// IUDEX — Home / Dashboard (DASH-001..008)
// ==========================================================================
import { h, formatDate, timeAgo, pickRandom, todayKey, escapeHTML } from "../../js/utils.js";
import { card } from "../../components/card.js";
import { skeleton } from "../../components/loader.js";
import { openModal, closeModal } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import {
  subscribe, getAll, orderBy, limit, where, setDocById, getDocById,
  updateDocById, subscribeDoc, serverTimestamp
} from "../../firebase/firestore.js";
import { auth } from "../../firebase/config.js";
import { navigate } from "../../js/router.js";

const MOOD_EMOJI = { great: "😄", happy: "🙂", okay: "😐", low: "😔", sleepy: "😴" };

const DAILY_QUESTIONS = [
  "What made you smile today?",
  "What's something you're looking forward to?",
  "Which movie should we watch next?",
  "What was the best part of your day?",
  "What's one small thing I did that made you happy recently?",
  "If today had a soundtrack, what song would play?"
];

export async function render(container) {
  const user = auth.currentUser;
  const firstName = (user?.displayName || "there").split(" ")[0];
  const unsubscribers = [];

  container.appendChild(
    h(`
      <div class="page">
        <div style="margin-bottom:24px;">
          <div class="eyebrow">${formatDate(new Date(), { weekday: "long" })}</div>
          <h1>Hey ${firstName} 👋</h1>
          <p style="margin-top:4px;">${formatDate(new Date())}</p>
        </div>

        <div id="dash-mood" style="margin-bottom:16px;">${skeleton("height:72px;")}</div>
        <div id="dash-memory" style="margin-bottom:16px;">${skeleton("height:100px;")}</div>
        <div id="dash-photo" style="margin-bottom:16px;">${skeleton("height:160px;")}</div>
        <div id="dash-question" style="margin-bottom:16px;">${skeleton("height:90px;")}</div>

        <div style="display:flex; gap:12px;">
          <button id="dash-continue-game" class="btn btn--ghost" style="flex:1;">▶ Continue game</button>
          <button id="dash-surprise" class="btn btn--primary" style="flex:1;">🎁 Surprise me</button>
        </div>
      </div>
    `)
  );

  // ---- Mood (DASH-005) — today's check-ins only ----
  unsubscribers.push(
    subscribe("moods", [where("date", "==", todayKey())], (docs) => {
      const el = document.getElementById("dash-mood");
      if (!el) return;
      if (!docs.length) {
        el.innerHTML = card({ eyebrow: "Mood", body: "No moods shared yet today.", interactive: true });
      } else {
        const items = docs
          .map((m) => `<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:24px;">${MOOD_EMOJI[m.mood] || "🙂"}</span><span class="text-secondary">${escapeHTML(m.name || "—")}</span></div>`)
          .join("");
        el.innerHTML = card({ eyebrow: "Today's mood", body: `<div style="display:flex; gap:24px;">${items}</div>`, interactive: true });
      }
      el.addEventListener("click", () => navigate("mood"));
    })
  );

  // ---- Latest memory (DASH-004) ----
  getAll("memories", [orderBy("date", "desc"), limit(1)])
    .then((docs) => {
      const el = document.getElementById("dash-memory");
      if (!el) return;
      if (!docs.length) {
        el.innerHTML = card({ eyebrow: "Recent memory", body: "No memories yet — add your first one!", interactive: true });
      } else {
        const m = docs[0];
        el.innerHTML = card({
          eyebrow: "Recent memory",
          title: m.title,
          body: `<p>${m.description || ""}</p>`,
          interactive: true
        });
      }
      el.addEventListener("click", () => navigate("memories"));
    })
    .catch((err) => reportError(err, "loading recent memory"));

  // ---- Latest photo (DASH-003) ----
  getAll("gallery", [orderBy("timestamp", "desc"), limit(1)])
    .then((docs) => {
      const el = document.getElementById("dash-photo");
      if (!el) return;
      if (!docs.length) {
        el.innerHTML = card({ eyebrow: "Latest photo", body: "No photos uploaded yet.", interactive: true });
      } else {
        const p = docs[0];
        el.innerHTML = `
          <div class="card card--interactive" style="padding:0; overflow:hidden;">
            <img src="${p.url}" alt="${p.title || "Shared photo"}" style="width:100%; height:180px; object-fit:cover; border-radius:24px;">
          </div>`;
      }
      el.addEventListener("click", () => navigate("gallery"));
    })
    .catch((err) => reportError(err, "loading latest photo"));

  // ---- Daily question (DASH-007 / U-001) — full answer + reveal flow ----
  function renderQuestionCard(doc) {
    const el = document.getElementById("dash-question");
    if (!el || !doc) return;
    const myUid = auth.currentUser?.uid;
    const answers = doc.answers || {};
    const myAnswer = answers[myUid];
    const otherEntry = Object.entries(answers).find(([entryUid]) => entryUid !== myUid);
    const otherAnswer = otherEntry?.[1];

    let body;
    if (!myAnswer) {
      body = `<button class="btn btn--primary" id="answer-daily-q" style="margin-top:8px;">Answer</button>`;
    } else if (!otherAnswer) {
      body = `
        <div class="daily-answer-block">
          <div class="text-xs text-muted" style="margin-bottom:4px;">You said</div>
          <p>${escapeHTML(myAnswer.text)}</p>
        </div>
        <p class="text-muted" style="margin-top:12px;">Waiting to see theirs 💭</p>`;
    } else {
      body = `
        <div class="daily-answer-block" style="margin-bottom:14px;">
          <div class="text-xs text-muted" style="margin-bottom:4px;">You said</div>
          <p>${escapeHTML(myAnswer.text)}</p>
        </div>
        <div class="daily-answer-block">
          <div class="text-xs text-muted" style="margin-bottom:4px;">${escapeHTML(otherAnswer.name || "They")} said</div>
          <p>${escapeHTML(otherAnswer.text)}</p>
        </div>`;
    }

    el.innerHTML = card({ eyebrow: "Daily question", title: doc.question, body });
    document.getElementById("answer-daily-q")?.addEventListener("click", () => openAnswerModal(doc.question));
  }

  function openAnswerModal(question) {
    openModal({
      title: "Daily question",
      bodyHTML: `
        <p class="text-muted" style="margin-bottom:12px;">${escapeHTML(question)}</p>
        <div class="field">
          <label for="daily-answer-input">Your answer</label>
          <textarea id="daily-answer-input" rows="4" placeholder="Type your answer…"></textarea>
        </div>
      `,
      actions: [
        { label: "Cancel", variant: "ghost" },
        {
          label: "Submit",
          variant: "primary",
          closeOnClick: false,
          onClick: async () => {
            const input = document.getElementById("daily-answer-input");
            const text = input.value.trim();
            if (!text) {
              showToast("Write something first.", "error");
              return;
            }
            input.disabled = true;
            try {
              const uid = auth.currentUser?.uid;
              const name = (auth.currentUser?.displayName || "").split(" ")[0] || "Partner";
              await updateDocById("dailyQuestions", todayKey(), {
                [`answers.${uid}`]: { text, name, answeredAt: serverTimestamp() }
              });
              showToast("Answer saved", "success");
              closeModal();
            } catch (err) {
              reportError(err, "saving answer");
              input.disabled = false;
            }
          }
        }
      ]
    });
    setTimeout(() => document.getElementById("daily-answer-input")?.focus(), 50);
  }

  (async () => {
    const key = todayKey();
    try {
      const existing = await getDocById("dailyQuestions", key);
      if (!existing) {
        const question = pickRandom(DAILY_QUESTIONS);
        await setDocById("dailyQuestions", key, { question, answers: {} }, false);
      }
    } catch (err) {
      reportError(err, "starting daily question");
    }
    unsubscribers.push(
      subscribeDoc("dailyQuestions", key, (doc) => {
        if (doc) renderQuestionCard(doc);
      })
    );
  })();

  // ---- Continue last game (DASH-006) ----
  document.getElementById("dash-continue-game").addEventListener("click", () => navigate("games"));

  // ---- Surprise button (DASH-008 / SUR-001..005) ----
  document.getElementById("dash-surprise").addEventListener("click", async () => {
    try {
      const pools = await Promise.all([
        getAll("memories", [orderBy("date", "desc"), limit(10)]),
        getAll("gallery", [orderBy("timestamp", "desc"), limit(10)]),
        getAll("bucketlist", [limit(10)])
      ]);
      const [memories, photos, tasks] = pools;
      const compliments = [
        "You make ordinary days feel like something worth remembering.",
        "Distance hasn't made this any less real — you're still my favorite person.",
        "Just a reminder: you're doing better than you think."
      ];
      const challenges = [
        "Send a voice note about your day (even though it's text-only for now, describe it!).",
        "Pick a song that describes your mood right now.",
        "Share one thing you're grateful for today."
      ];

      const options = [
        memories.length && { type: "Memory", text: pickRandom(memories).title },
        photos.length && { type: "Photo", text: pickRandom(photos).title || "A shared photo" },
        { type: "Compliment", text: pickRandom(compliments) },
        { type: "Challenge", text: pickRandom(challenges) },
        tasks.length && { type: "Bucket list", text: pickRandom(tasks).title }
      ].filter(Boolean);

      const surprise = pickRandom(options);
      openModal({
        title: `🎁 ${surprise.type}`,
        bodyHTML: `<p style="font-size:1.1rem;">${surprise.text}</p>`,
        actions: [{ label: "Nice ✨", variant: "primary" }]
      });
    } catch (err) {
      reportError(err, "generating surprise");
    }
  });

  return function teardown() {
    unsubscribers.forEach((unsub) => unsub());
  };
}
