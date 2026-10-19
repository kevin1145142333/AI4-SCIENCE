// 视觉特效：星空粒子 / 按钮涟漪 / 音效合成

import { store, persistSettings } from "./store.js";

let audioCtx = null;
let stars = [];
let rafId = null;

export function applyFxSettings() {
  document.body.classList.toggle("perf-mode", !!store.settings.performance);
  const particles = store.settings.particles && !store.settings.performance;
  if (particles) {
    startStarfield();
  } else {
    stopStarfield();
    const canvas = document.getElementById("starfield");
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }
  const soundBtn = document.getElementById("btn-sound");
  if (soundBtn) soundBtn.setAttribute("aria-pressed", String(!!store.settings.sound));
  const perfBtn = document.getElementById("btn-perf");
  if (perfBtn) perfBtn.setAttribute("aria-pressed", String(!!store.settings.performance));
}

function startStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const resize = () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    const count = Math.min(220, Math.floor((canvas.width * canvas.height) / 28000));
    stars = Array.from({ length: count }, () => spawnStar(canvas));
  };
  resize();
  window.addEventListener("resize", resize);
  const step = (t) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.y += s.vy;
      if (s.y > canvas.height) Object.assign(s, spawnStar(canvas), { y: -2 });
      const tw = 0.55 + 0.45 * Math.sin(t / 900 + s.phase);
      ctx.globalAlpha = tw;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(step);
  };
  stopStarfield();
  rafId = requestAnimationFrame(step);
}

function stopStarfield() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function spawnStar(canvas) {
  const palette = ["#35e6ff", "#a06bff", "#dceaff", "#ff5a8a", "#8fa6c8"];
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: (Math.random() * 1.6 + 0.4) * devicePixelRatio,
    vy: (Math.random() * 0.25 + 0.04) * devicePixelRatio,
    phase: Math.random() * Math.PI * 2,
    color: palette[(Math.random() * palette.length) | 0],
  };
}

// 按钮点击涟漪
export function bindRipple() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn, .nav-btn, .icon-btn, .chip");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const span = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 1.1;
    span.className = "ripple";
    span.style.width = span.style.height = size + "px";
    span.style.left = e.clientX - rect.left - size / 2 + "px";
    span.style.top = e.clientY - rect.top - size / 2 + "px";
    btn.appendChild(span);
    setTimeout(() => span.remove(), 560);
  });
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function playSound(kind = "click") {
  if (!store.settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (kind === "confirm") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.24);
  } else if (kind === "error") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.18);
  } else {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(720, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

export function toggleSound() {
  store.settings.sound = !store.settings.sound;
  persistSettings();
  applyFxSettings();
  if (store.settings.sound) playSound("confirm");
}

export function togglePerformance() {
  store.settings.performance = !store.settings.performance;
  persistSettings();
  applyFxSettings();
}
