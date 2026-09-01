// ==========================================================================
// IUDEX — Music (MUS-001..006)
// A synced listening room: paste a YouTube link, it plays at the same
// timestamp on both devices. Playback itself is owned by js/musicPlayer.js
// (a shell-level singleton) so it survives navigating to other pages —
// this module is just the full-screen view + "add a song" flow.
// ==========================================================================
import { h, escapeHTML, truncate, attachSwipeToDismiss } from "../../js/utils.js";
import { skeletonList } from "../../components/loader.js";
import { openModal, closeModal } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import {
  subscribeMusicState, togglePlayPause, commitSeek, skip,
  playFromQueue, addToQueue, removeFromQueue, getMyRole
} from "../../js/musicPlayer.js";

function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

async function fetchYouTubeMeta(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) throw new Error("oembed failed");
    const data = await res.json();
    return { title: data.title || "YouTube video", author: data.author_name || "" };
  } catch {
    return { title: "YouTube video", author: "" };
  }
}

function thumbnailFor(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function render(container) {
  container.appendChild(
    h(`
      <div class="page music-page">
        <h1 style="margin-bottom:20px;">Music</h1>

        <div class="music-player glass">
          <div class="music-art-wrap">
            <div class="music-art-bg" id="music-art-bg"></div>
            <div class="music-disc" id="music-disc">
              <div class="music-disc-art" id="music-disc-art"></div>
              <div class="music-disc-hole"></div>
            </div>
          </div>

          <div class="music-meta">
            <h3 id="music-title">Nothing playing</h3>
            <p class="text-muted" id="music-author">Add a song to start the room</p>
          </div>

          <div class="music-progress-row">
            <span class="music-time" id="music-time-current">0:00</span>
            <input type="range" class="music-seek" id="music-seek" min="0" max="100" value="0" step="1" disabled>
            <span class="music-time" id="music-time-total">0:00</span>
          </div>

          <div class="music-controls">
            <button class="btn btn--icon music-ctrl-btn" id="music-skip" aria-label="Skip to next" disabled>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <button class="music-play-btn" id="music-playpause" aria-label="Play" disabled>
              <svg id="music-play-icon" viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin:28px 0 14px;">
          <h3>Up next</h3>
          <button class="btn btn--primary btn--icon" id="add-song-btn" aria-label="Add a song">+</button>
        </div>
        <div id="music-queue">${skeletonList(3, "height:64px; margin-bottom:10px;")}</div>
      </div>
    `)
  );

  const artBg = document.getElementById("music-art-bg");
  const discArt = document.getElementById("music-disc-art");
  const disc = document.getElementById("music-disc");
  const titleEl = document.getElementById("music-title");
  const authorEl = document.getElementById("music-author");
  const seekEl = document.getElementById("music-seek");
  const timeCurrentEl = document.getElementById("music-time-current");
  const timeTotalEl = document.getElementById("music-time-total");
  const playPauseBtn = document.getElementById("music-playpause");
  const playIcon = document.getElementById("music-play-icon");
  const skipBtn = document.getElementById("music-skip");
  const queueEl = document.getElementById("music-queue");
  const addBtn = document.getElementById("add-song-btn");

  let userIsScrubbing = false;
  let latestQueue = [];
  let lastRenderedQueueKey = "";

  // Swipe-to-delete state — a swipe (or the ✕ button) plays a slide-out
  // animation immediately, but the actual Firestore delete is delayed a
  // few seconds behind an "Undo" toast, so a stray swipe isn't final.
  const rowHandles = new Map(); // id -> { handle, rowEl }
  const pendingRemovals = new Map(); // id -> setTimeout handle

  function scheduleRemoval(item) {
    if (pendingRemovals.has(item.id)) return;
    const timer = setTimeout(async () => {
      pendingRemovals.delete(item.id);
      try {
        await removeFromQueue(item.id);
      } catch (err) {
        reportError(err, "removing from queue");
      }
    }, 4000);
    pendingRemovals.set(item.id, timer);

    showToast(`Removed "${escapeHTML(truncate(item.title || "song", 28))}" from the queue`, "info", 4000, {
      actionLabel: "Undo",
      onAction: () => {
        const t = pendingRemovals.get(item.id);
        if (!t) return; // already committed, too late to undo
        clearTimeout(t);
        pendingRemovals.delete(item.id);
        rowHandles.get(item.id)?.handle.restore();
      }
    });
  }

  function setPlayIcon(isPlaying) {
    playIcon.innerHTML = isPlaying
      ? `<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>`
      : `<path d="M8 5v14l11-7z"/>`;
    playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  }

  function renderNowPlaying(room, position, duration) {
    if (!room?.videoId) {
      titleEl.textContent = "Nothing playing";
      authorEl.textContent = latestQueue.length ? "Play something from the queue" : "Add a song to start the room";
      artBg.style.backgroundImage = "";
      discArt.style.backgroundImage = "";
      disc.classList.remove("playing");
      seekEl.disabled = true;
      seekEl.value = 0;
      timeCurrentEl.textContent = "0:00";
      timeTotalEl.textContent = "0:00";
      playPauseBtn.disabled = true;
      skipBtn.disabled = latestQueue.length === 0;
      setPlayIcon(false);
      return;
    }
    titleEl.textContent = room.title || "YouTube video";
    authorEl.textContent = room.author || "";
    const thumb = room.thumbnail || thumbnailFor(room.videoId);
    artBg.style.backgroundImage = `url("${thumb}")`;
    discArt.style.backgroundImage = `url("${thumb}")`;
    disc.classList.toggle("playing", !!room.isPlaying);
    seekEl.disabled = false;
    playPauseBtn.disabled = false;
    skipBtn.disabled = false;
    setPlayIcon(!!room.isPlaying);

    if (!userIsScrubbing && duration > 0) {
      seekEl.max = Math.floor(duration);
      seekEl.value = Math.floor(position);
      timeTotalEl.textContent = formatTime(duration);
      timeCurrentEl.textContent = formatTime(position);
    }
  }

  function renderQueue(items, roomActive) {
    const key = items.map((i) => i.id).join(",");
    if (key === lastRenderedQueueKey) return; // avoid re-triggering entrance animation every tick
    lastRenderedQueueKey = key;

    if (!items.length) {
      queueEl.innerHTML = `
        <div class="empty-state" style="padding:var(--space-8) var(--space-5);">
          <div style="font-size:28px;">🎵</div>
          <p>The queue is empty. Paste a YouTube link to add the first song.</p>
        </div>`;
    } else {
      rowHandles.clear();
      queueEl.innerHTML = items
        .map(
          (item, i) => `
          <div class="queue-swipe-row" style="--stagger-index:${i};" data-id="${item.id}">
            <div class="queue-swipe-bg" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-2 6h2v9H7V9zm4 0h2v9h-2V9zm4 0h2v9h-2V9z"/></svg>
            </div>
            <div class="card music-queue-item swipe-target stagger-item">
              <div class="music-queue-thumb" style="background-image:url('${item.thumbnail || thumbnailFor(item.videoId)}')"></div>
              <div class="music-queue-info">
                <div class="music-queue-title">${escapeHTML(item.title || "YouTube video")}</div>
                <div class="music-queue-author text-muted">${escapeHTML(item.author || "")}</div>
              </div>
              <button class="btn btn--icon" data-action="play" aria-label="Play now" style="width:38px;height:38px;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="btn btn--icon" data-action="remove" aria-label="Remove" style="width:38px;height:38px;">✕</button>
            </div>
          </div>`
        )
        .join("");

      queueEl.querySelectorAll(".queue-swipe-row").forEach((rowEl) => {
        const id = rowEl.dataset.id;
        const item = latestQueue.find((q) => q.id === id);
        if (!item) return;

        const targetEl = rowEl.querySelector(".swipe-target");
        const bgEl = rowEl.querySelector(".queue-swipe-bg");
        const handle = attachSwipeToDismiss(targetEl, bgEl, {
          threshold: 88,
          onCommit: () => scheduleRemoval(item)
        });
        rowHandles.set(id, { handle, rowEl });

        targetEl.querySelector("[data-action='play']").addEventListener("click", () => {
          playFromQueue(item).catch((err) => reportError(err, "playing queued song"));
        });
        // Same slide-out + undo flow as a completed swipe — tapping ✕
        // is never an instant, unrecoverable delete.
        targetEl.querySelector("[data-action='remove']").addEventListener("click", () => {
          handle.commit();
        });
      });
    }
  }

  playPauseBtn.addEventListener("click", togglePlayPause);
  skipBtn.addEventListener("click", () => skip().catch((err) => reportError(err, "skipping song")));

  seekEl.addEventListener("input", () => {
    userIsScrubbing = true;
    timeCurrentEl.textContent = formatTime(Number(seekEl.value));
  });
  seekEl.addEventListener("change", () => {
    userIsScrubbing = false;
    commitSeek(Number(seekEl.value)).catch((err) => reportError(err, "seeking"));
  });

  addBtn.addEventListener("click", () => {
    openModal({
      title: "Add a song",
      bodyHTML: `
        <div class="field">
          <label for="yt-url-input">Paste a YouTube link</label>
          <input id="yt-url-input" type="url" placeholder="https://youtube.com/watch?v=…" autocomplete="off">
        </div>
      `,
      actions: [
        { label: "Cancel", variant: "ghost" },
        {
          label: "Add to queue",
          variant: "primary",
          closeOnClick: false,
          onClick: async () => {
            const input = document.getElementById("yt-url-input");
            const url = input.value.trim();
            const videoId = extractYouTubeId(url);
            if (!videoId) {
              showToast("That doesn't look like a valid YouTube link.", "error");
              input.focus();
              return;
            }
            input.disabled = true;
            const meta = await fetchYouTubeMeta(videoId);
            try {
              await addToQueue({
                videoId,
                title: meta.title,
                author: meta.author,
                thumbnail: thumbnailFor(videoId),
                addedBy: getMyRole()
              });
              showToast("Added to the queue", "success");
              closeModal();
            } catch (err) {
              reportError(err, "adding song");
              input.disabled = false;
            }
          }
        }
      ]
    });
    setTimeout(() => document.getElementById("yt-url-input")?.focus(), 50);
  });

  const unsub = subscribeMusicState(({ room, queue, position, duration }) => {
    latestQueue = queue;
    renderNowPlaying(room, position, duration);
    renderQueue(queue, !!room?.videoId);
  });

  return function teardown() {
    unsub?.();
  };
}
