// ==========================================================================
// Shideep — Persistent Mini Player
// Lives in the app shell (mounted once, alongside the navbar), not inside
// any page's outlet — so it keeps showing/controlling playback no matter
// which page you're on. Tapping the bar itself opens the full Music page;
// the play/pause button works right there without navigating.
// ==========================================================================
import { h, escapeHTML } from "../js/utils.js";
import { subscribeMusicState, togglePlayPause } from "../js/musicPlayer.js";
import { navigate } from "../js/router.js";

export function renderMiniPlayer(container) {
  const bar = h(`
    <div class="mini-player" id="mini-player" hidden>
      <div class="mini-player-thumb" id="mini-player-thumb"></div>
      <div class="mini-player-info">
        <div class="mini-player-title" id="mini-player-title"></div>
        <div class="mini-player-progress"><div class="mini-player-progress-fill" id="mini-player-fill"></div></div>
      </div>
      <button class="mini-player-btn" id="mini-player-btn" aria-label="Play">
        <svg id="mini-player-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
      </button>
    </div>
  `);
  container.appendChild(bar);

  const thumbEl = document.getElementById("mini-player-thumb");
  const titleEl = document.getElementById("mini-player-title");
  const fillEl = document.getElementById("mini-player-fill");
  const btn = document.getElementById("mini-player-btn");
  const icon = document.getElementById("mini-player-icon");

  bar.addEventListener("click", (e) => {
    if (e.target.closest("#mini-player-btn")) return;
    navigate("music");
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlayPause();
  });

  subscribeMusicState(({ room, position, duration }) => {
    const active = !!room?.videoId;
    bar.hidden = !active;
    document.body.classList.toggle("mini-player-active", active);
    if (!active) return;

    titleEl.textContent = room.title || "YouTube video";
    thumbEl.style.backgroundImage = `url("${room.thumbnail || ""}")`;
    icon.innerHTML = room.isPlaying
      ? `<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>`
      : `<path d="M8 5v14l11-7z"/>`;
    btn.setAttribute("aria-label", room.isPlaying ? "Pause" : "Play");
    const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
    fillEl.style.width = `${pct}%`;
  });
}
