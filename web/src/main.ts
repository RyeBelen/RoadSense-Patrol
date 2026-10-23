import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700-italic.css";
import "./style.css";
import { Game } from "./game.ts";
import { World } from "./world.ts";
import { Sound } from "./audio.ts";
import {
  loadScores,
  saveScore,
  loadSettings,
  saveSettings,
} from "./storage.ts";

const roadIcon =
  '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 4h14l5 24H4L9 4Z" stroke="currentColor" stroke-width="2"/><path d="M16 5v5m0 4v5m0 4v5" stroke="currentColor" stroke-width="2"/></svg>';
const arrowLeft =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const arrowRight =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main id="game-shell" class="is-menu">
    <div id="scene"></div><div class="menu-wash"></div><div id="hit-flash"></div>
    <header class="topbar"><a class="brand" href="./" aria-label="RoadSense Patrol home">${roadIcon}<span>roadsense<span class="brand-sub">Patrol division</span></span></a>
      <div class="top-actions"><button id="sound" class="utility" aria-label="Mute sound">Sound on</button><button id="fullscreen" class="utility" aria-label="Enter fullscreen">Full screen</button><button id="pause" class="utility" hidden>Pause <kbd>Esc</kbd></button></div>
    </header>
    <div id="hud" hidden>
      <div class="score-block"><span class="eyelabel">Patrol score</span><strong id="score">0</strong><div class="chain"><span id="multiplier">×1</span><span id="streak">0 clean hazards</span></div></div>
      <div class="run-health"><span class="eyelabel">Vehicle condition</span><div id="lives" aria-label="3 lives remaining"></div><div id="equipment"></div></div>
      <div id="warning" role="status" aria-live="polite" hidden><span class="warning-icon">!</span><div><strong id="warning-title"></strong><span id="warning-action"></span></div></div>
      <div id="feedback" role="status" aria-live="polite"></div>
      <div class="bottom-instruments"><div class="scanner-instrument"><div class="instrument-title"><span class="radar-dot"></span><strong>Road scanner</strong><kbd>B</kbd></div><div class="meter"><i id="energy"></i></div><div class="scanner-status"><span id="scan-label">Ready</span><span id="energy-label">100%</span></div><div class="cooldown-meter"><i id="cooldown"></i></div><div class="control-hint">Hold to scan all lanes</div></div>
      <div class="trip"><span id="distance">0.00 km</span><span id="elapsed">00:00</span><button id="camera" class="camera-button">Chase camera <kbd>C</kbd></button></div>
      <div class="speedometer"><div><strong id="speed">80</strong><span>km/h</span></div><span id="drive-state">Cruising</span><div class="speed-track"><i id="speed-meter"></i></div></div></div>
      <div id="touch-controls"><div class="steering"><button id="left" aria-label="Steer left">${arrowLeft}</button><button id="right" aria-label="Steer right">${arrowRight}</button></div><div class="pedals"><button id="scan-control" aria-label="Hold to scan">Scan</button><button id="brake-control" aria-label="Hold to brake">Brake</button><button id="boost-control" aria-label="Hold to accelerate">Boost</button></div></div>
    </div>
    <div id="overlay"></div>
    <footer id="menu-footer"><span>Coastal highway <span class="route-dot"></span> Day patrol</span><span>A road awareness game</span></footer>
    <div id="notice" role="status" aria-live="polite"></div>
  </main>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const shell = el("game-shell"),
  overlay = el("overlay");
const game = new Game();
const sound = new Sound();
const settings = loadSettings();
sound.muted = settings.muted;
game.sound = (name) => sound.play(name);
let world: World;
let view: "main" | "guide" | "rankings" = "main";
let saved = false;
let saveMessage = "";
let previousPhase = "";
let noticeTimer = 0;
function notice(text: string) {
  el("notice").textContent = text;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => (el("notice").textContent = ""), 3500);
}
function updateSound() {
  el("sound").textContent = sound.muted ? "Sound off" : "Sound on";
  el("sound").setAttribute(
    "aria-label",
    sound.muted ? "Unmute sound" : "Mute sound",
  );
  el("sound").setAttribute("aria-pressed", String(sound.muted));
}
updateSound();
function start() {
  sound.unlock();
  game.start();
  view = "main";
  saved = false;
  saveMessage = "";
  renderOverlay();
}
function pause() {
  game.pause();
  view = "main";
  renderOverlay();
}
function resume() {
  game.resume();
  view = "main";
  renderOverlay();
}
function home() {
  game.phase = "menu";
  game.clearInput();
  view = "main";
  renderOverlay();
}
function button(id: string, action: () => void) {
  document.getElementById(id)?.addEventListener("click", action);
}

function guide() {
  return `<section class="modal wide" aria-labelledby="guide-title"><div class="panel-heading"><span class="section-label">Field guide</span><button id="back" class="text-button">Back</button></div><h1 id="guide-title">Read the road.</h1><p>Spot hazards early. A clean response builds your score multiplier, up to ×8.</p>
    <div class="hazard-guide"><div><span class="hazard-sample pothole"></span><h2>Major potholes</h2><p>Change lane. Braking alone won't protect you.</p></div><div><span class="hazard-sample hump"></span><h2>Rough road</h2><p>Hold Brake for minor potholes, patches, and speed humps. You can also steer around them.</p></div><div><span class="hazard-sample traffic"></span><h2>Traffic</h2><p>Avoid cars and trucks. Watch for motorcycles changing lanes as your patrol progresses.</p></div></div>
    <div class="guide-bottom"><div><h2>Your scanner</h2><p>Radar marks hazards in your lane. Hold Scan to detect all lanes farther ahead and double clean-hazard points. Release for a 3-second cooldown, or 5 seconds if depleted.</p><h2>Roadside support</h2><p>Blue shields absorb a road-hazard hit. Green repair tokens clear the next hazard. Gold signal tokens give 5 seconds of wide radar.</p></div><div class="keys"><div><span>Steer</span><span><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd></span></div><div><span>Accelerate</span><span><kbd>W</kbd> / <kbd>↑</kbd></span></div><div><span>Brake</span><span><kbd>S</kbd> / <kbd>↓</kbd></span></div><div><span>Scan</span><kbd>B</kbd></div><div><span>Camera</span><kbd>C</kbd></div><div><span>Pause / mute</span><span><kbd>Esc</kbd> / <kbd>M</kbd></span></div></div></div>
    <p class="fine-print">Touch controls appear on touchscreens. Hazards and detections are simulated. This game does not run the RoadSense AI model.</p></section>`;
}
function rankings() {
  const scores = loadScores();
  return `<section class="modal" aria-labelledby="rankings-title"><div class="panel-heading"><span class="section-label">Local Top 10</span><button id="back" class="text-button">Back</button></div><h1 id="rankings-title">The patrol board.</h1><p>Best runs saved in this browser.</p>${scores.length ? `<ol class="leaderboard">${scores.map((s, i) => `<li><span class="rank">${String(i + 1).padStart(2, "0")}</span><strong>${s.name}</strong><span>${(s.distance / 1000).toFixed(2)} km</span><b>${s.score.toLocaleString()}</b></li>`).join("")}</ol>` : '<div class="empty-board">No patrols on the board yet.<br>Finish a run to set the first score.</div>'}<button id="board-play" class="primary">${game.phase === "paused" ? "Resume patrol" : "Start a patrol"} ${arrowRight}</button></section>`;
}
function renderOverlay() {
  const phase = game.phase;
  shell.className = `is-${phase}${view !== "main" ? " has-dialog" : ""}`;
  el("hud").hidden = phase === "menu";
  el("pause").hidden = !["playing", "countdown", "paused"].includes(phase);
  el("pause").innerHTML =
    phase === "paused" ? "Resume <kbd>Esc</kbd>" : "Pause <kbd>Esc</kbd>";
  el("menu-footer").hidden = phase !== "menu";
  if (view === "guide") overlay.innerHTML = guide();
  else if (view === "rankings") overlay.innerHTML = rankings();
  else if (phase === "menu")
    overlay.innerHTML = `<section class="menu-panel" aria-labelledby="game-title"><div class="route-label"><span></span> Coastal highway</div><h1 id="game-title">RoadSense<br>Patrol<span class="title-stop">.</span></h1><p class="intro">An open road. A sharper instinct.<br>Spot the hazards. Bring your patrol home.</p><button id="start" class="primary">Start patrol ${arrowRight}</button><div class="menu-links"><button id="guide" class="text-button">How to play</button><button id="rankings" class="text-button">Patrol board</button></div><div class="menu-controls"><span><kbd>←</kbd><kbd>→</kbd> Steer</span><span><kbd>S</kbd> Brake</span><span><kbd>B</kbd> Scan</span></div><label class="quality-select">Graphics <select id="quality" aria-label="Graphics quality"><option value="high" ${settings.highQuality ? "selected" : ""}>High</option><option value="low" ${!settings.highQuality ? "selected" : ""}>Performance</option></select></label></section>`;
  else if (phase === "paused")
    overlay.innerHTML = `<section class="modal compact" aria-labelledby="pause-title"><span class="section-label">Patrol paused</span><h1 id="pause-title">Take a breather.</h1><p>Your road will be here when you're ready.</p><button id="resume" class="primary">Resume patrol ${arrowRight}</button><div class="menu-links"><button id="guide" class="text-button">Field guide</button><button id="rankings" class="text-button">Patrol board</button></div><button id="quit" class="secondary">End patrol</button></section>`;
  else if (phase === "countdown")
    overlay.innerHTML = `<div class="countdown"><span>Eyes on the road</span><strong id="countdown-number">${Math.ceil(game.countdown)}</strong><span>Three lives. Make them count.</span></div>`;
  else if (phase === "crashing")
    overlay.innerHTML =
      '<div class="crash-message"><span>Patrol ended</span><button id="skip" class="secondary">View results</button></div>';
  else if (phase === "results")
    overlay.innerHTML = `<section class="modal results" aria-labelledby="results-title"><span class="section-label">Patrol report</span><h1 id="results-title">End of the road.</h1><div class="result-score">${game.score.toLocaleString()}<span>points earned</span></div><div class="result-stats"><div><strong>${(game.distance / 1000).toFixed(2)}</strong><span>km covered</span></div><div><strong>${game.accuracy}%</strong><span>hazards handled</span></div><div><strong>${game.bestStreak}</strong><span>best streak</span></div></div><form id="score-form"><label for="initials">Your initials</label><div class="score-entry"><input id="initials" name="initials" maxlength="3" minlength="3" pattern="[A-Za-z]{3}" aria-describedby="score-status" value="AAA" autocomplete="off" autocapitalize="characters" spellcheck="false" required ${saved ? "disabled" : ""}/><button class="secondary" type="submit" ${saved ? "disabled" : ""}>${saved ? "Score saved" : "Save score"}</button></div><p id="score-status" class="fine-print" role="status">${saveMessage || "Rankings stay in this browser."}</p></form><button id="replay" class="primary">Patrol again ${arrowRight}</button><div class="menu-links"><button id="rankings" class="text-button">Patrol board</button><button id="home" class="text-button">Main menu</button></div></section>`;
  else overlay.innerHTML = "";
  button("start", start);
  button("resume", resume);
  button("replay", start);
  button("home", home);
  button("quit", () => {
    game.phase = "results";
    game.clearInput();
    renderOverlay();
  });
  button("guide", () => {
    view = "guide";
    renderOverlay();
  });
  button("rankings", () => {
    view = "rankings";
    renderOverlay();
  });
  button("back", () => {
    view = "main";
    renderOverlay();
  });
  button("board-play", () => (game.phase === "paused" ? resume() : start()));
  button("skip", () => {
    game.phase = "results";
    renderOverlay();
  });
  document.getElementById("quality")?.addEventListener("change", (event) => {
    settings.highQuality = (event.target as HTMLSelectElement).value === "high";
    world.setQuality(settings.highQuality);
    saveSettings(settings);
  });
  document.getElementById("score-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (saved) return;
    const name = el<HTMLInputElement>("initials").value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(name)) {
      el("score-status").textContent = "Enter three letters, A to Z.";
      return;
    }
    saved = saveScore({
      name,
      score: game.score,
      distance: game.distance,
      date: new Date().toISOString(),
    });
    saveMessage = saved
      ? "Saved to this browser’s patrol board."
      : "Browser storage is unavailable. Your score could not be saved.";
    renderOverlay();
  });
  if (phase === "paused" || phase === "results" || view !== "main")
    overlay
      .querySelector<HTMLElement>("button, input")
      ?.focus({ preventScroll: true });
}

function updateHud() {
  el("score").textContent = game.score.toLocaleString();
  el("multiplier").textContent = `×${game.multiplier}`;
  el("streak").textContent =
    `${game.streak} clean ${game.streak === 1 ? "hazard" : "hazards"}`;
  const health = el("lives");
  if (health.dataset.value !== String(game.lives)) {
    health.dataset.value = String(game.lives);
    health.innerHTML = Array.from(
      { length: 3 },
      (_, i) => `<span class="life ${i < game.lives ? "" : "lost"}"></span>`,
    ).join("");
    health.setAttribute("aria-label", `${game.lives} lives remaining`);
  }
  el("equipment").textContent = [
    game.shield ? `Shield ×${game.shield}` : "",
    game.repair ? `Repair ×${game.repair}` : "",
    game.signal > 0 ? `Signal ${Math.ceil(game.signal)}s` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const warning = game.warning;
  el("warning").hidden = !warning || game.phase !== "playing";
  if (warning) {
    el("warning-title").textContent = warning.title;
    el("warning-action").textContent = warning.action;
    el("warning").classList.toggle("danger", warning.danger);
  }
  el("feedback").textContent = game.messageTime > 0 ? game.message : "";
  el("speed").textContent = String(game.kph);
  el("drive-state").textContent = game.brake
    ? "Braking"
    : game.boost > 0.1
      ? "Boosting"
      : game.scanning
        ? "Scanning"
        : "Cruising";
  el("speed-meter").style.width = `${Math.min(100, (game.speed / 64) * 100)}%`;
  el("distance").textContent = `${(game.distance / 1000).toFixed(2)} km`;
  el("elapsed").textContent =
    `${String(Math.floor(game.time / 60)).padStart(2, "0")}:${String(Math.floor(game.time % 60)).padStart(2, "0")}`;
  el("energy").style.width = `${game.scanEnergy * 100}%`;
  el("energy-label").textContent = `${Math.round(game.scanEnergy * 100)}%`;
  el("scan-label").textContent = game.scanning
    ? "Scanning all lanes"
    : game.scanCooldown > 0
      ? `Cooling down ${game.scanCooldown.toFixed(1)}s`
      : game.scanEnergy < 0.25
        ? "Recharging"
        : !game.scanArmed
          ? "Release to rearm"
          : "Ready";
  el("cooldown").style.width =
    game.scanCooldown > 0
      ? `${100 * (1 - game.scanCooldown / game.scanCooldownDuration)}%`
      : "100%";
  el("hit-flash").style.opacity = String(game.hitFlash * 0.45);
  if (game.phase === "countdown" && el("countdown-number"))
    el("countdown-number").textContent = String(
      Math.max(1, Math.ceil(game.countdown)),
    );
  el("brake-control").classList.toggle("held", game.brake);
  el("boost-control").classList.toggle("held", game.accelerate);
  el("scan-control").classList.toggle("held", game.scanning);
}

function toggleMute() {
  sound.unlock();
  sound.muted = !sound.muted;
  settings.muted = sound.muted;
  saveSettings(settings);
  updateSound();
}
function toggleCamera() {
  world.hood = !world.hood;
  el("camera").innerHTML =
    `${world.hood ? "Hood" : "Chase"} camera <kbd>C</kbd>`;
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.requestFullscreen();
  } catch {
    notice("Full screen is unavailable in this browser.");
  }
}
button("sound", toggleMute);
button("fullscreen", () => void toggleFullscreen());
button("pause", () => (game.phase === "paused" ? resume() : pause()));
button("camera", toggleCamera);
document.addEventListener("fullscreenchange", () => {
  el("fullscreen").textContent = document.fullscreenElement
    ? "Exit full screen"
    : "Full screen";
});

function bindHold(id: string, set: (value: boolean) => void) {
  const target = el(id);
  target.addEventListener("pointerdown", (event) => {
    if (game.phase !== "playing") return;
    event.preventDefault();
    sound.unlock();
    target.setPointerCapture(event.pointerId);
    set(true);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    target.addEventListener(event, () => set(false));
  target.addEventListener("keydown", (event) => {
    if (
      (event.code === "Space" || event.code === "Enter") &&
      game.phase === "playing"
    ) {
      event.preventDefault();
      event.stopPropagation();
      set(true);
    }
  });
  target.addEventListener("keyup", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      set(false);
    }
  });
  target.addEventListener("contextmenu", (event) => event.preventDefault());
}
bindHold("brake-control", (held) => game.setBrake(held));
bindHold("boost-control", (held) => (game.accelerate = held));
bindHold("scan-control", (held) => (game.scanHeld = held));
button("left", () => game.turn(-1));
button("right", () => game.turn(1));
const heldKeys = new Set<string>();
const movementCodes = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "KeyB",
];
window.addEventListener("keydown", (event) => {
  if (
    event.code === "Tab" &&
    (game.phase === "paused" || game.phase === "results" || view !== "main")
  ) {
    const focusables = Array.from(
      overlay.querySelectorAll<HTMLElement>(
        "button:not([disabled]),input:not([disabled]),select",
      ),
    );
    const first = focusables[0],
      last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement
  )
    return;
  if (
    event.target instanceof HTMLButtonElement &&
    (event.code === "Space" || event.code === "Enter")
  )
    return;
  if (movementCodes.includes(event.code) || event.code === "Space")
    event.preventDefault();
  if (event.repeat) return;
  heldKeys.add(event.code);
  if (event.code === "Escape") {
    if (view !== "main") {
      view = "main";
      renderOverlay();
    } else if (game.phase === "paused") resume();
    else pause();
  }
  if (event.code === "KeyM") toggleMute();
  if (event.code === "KeyC" && game.phase === "playing") toggleCamera();
  if (event.code === "KeyF") void toggleFullscreen();
  if (
    (event.code === "Space" || event.code === "Enter") &&
    !(event.target instanceof HTMLButtonElement)
  ) {
    if (game.phase === "menu" && view === "main") start();
    else if (game.phase === "crashing") {
      game.phase = "results";
      renderOverlay();
    }
  }
  if (game.phase !== "playing") return;
  if (event.code === "ArrowLeft" || event.code === "KeyA") game.turn(-1);
  if (event.code === "ArrowRight" || event.code === "KeyD") game.turn(1);
  game.setBrake(heldKeys.has("KeyS") || heldKeys.has("ArrowDown"));
  game.accelerate = heldKeys.has("KeyW") || heldKeys.has("ArrowUp");
  game.scanHeld = heldKeys.has("KeyB");
});
window.addEventListener("keyup", (event) => {
  heldKeys.delete(event.code);
  game.setBrake(heldKeys.has("KeyS") || heldKeys.has("ArrowDown"));
  game.accelerate = heldKeys.has("KeyW") || heldKeys.has("ArrowUp");
  game.scanHeld = heldKeys.has("KeyB");
});
function loseFocus() {
  heldKeys.clear();
  game.clearInput();
  if (game.phase === "playing" || game.phase === "countdown") pause();
  sound.update(0, false);
}
window.addEventListener("blur", loseFocus);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) loseFocus();
});
window.addEventListener("resize", () => world?.resize());

try {
  world = new World(el("scene"));
  if (!settings.highQuality) world.setQuality(false);
  world.renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    loseFocus();
    notice("Graphics connection lost. Reload the page to continue.");
  });
  world.renderer.domElement.addEventListener("webglcontextrestored", () =>
    location.reload(),
  );
  renderOverlay();
  let last = performance.now(),
    hudTime = 0;
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    // Substeps retain elapsed time on slower devices without skipping collisions.
    for (let remaining = dt; remaining > 0; remaining -= 1 / 60) {
      game.update(Math.min(remaining, 1 / 60));
    }
    if (game.phase !== previousPhase) {
      previousPhase = game.phase;
      renderOverlay();
    }
    hudTime += dt;
    if (hudTime >= 0.08) {
      updateHud();
      hudTime = 0;
    }
    sound.update(game.speed, game.phase === "playing");
    world.render(game, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only diagnostics support browser QA without a production gameplay backdoor.
  Object.defineProperty(window, "__patrol", {
    value: () => ({
      phase: game.phase,
      score: game.score,
      lives: game.lives,
      lane: game.lane,
      x: game.x,
      time: game.time,
      distance: game.distance,
      scanEnergy: game.scanEnergy,
      scanCooldown: game.scanCooldown,
      scanning: game.scanning,
      boost: game.boost,
      brake: game.brake,
      objects: game.objects.length,
      camera: world.hood ? "hood" : "chase",
      drawCalls: world.renderer.info.render.calls,
      triangles: world.renderer.info.render.triangles,
    }),
  });
} catch (error) {
  console.error("Could not initialize 3D renderer", error);
  overlay.innerHTML =
    '<section class="modal"><h1>Graphics unavailable.</h1><p>RoadSense Patrol needs WebGL 2. Enable graphics acceleration in your browser, or try a recent version of Chrome, Edge, Firefox, or Safari.</p><button id="reload" class="primary">Try again</button></section>';
  button("reload", () => location.reload());
}
