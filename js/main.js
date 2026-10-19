// 应用入口：路由 / 导航 / 命令面板 / 全局交互

import { store, persistSettings } from "./store.js";
import { parseRoute, navigate } from "./router.js";
import { h, esc } from "./ui.js";
import { applyFxSettings, bindRipple, toggleSound, togglePerformance } from "./fx.js";

import * as workbench from "./views/workbench.js?v=20261016b";
import * as guide from "./views/guide.js?v=20261016b";

const view = document.getElementById("view");
const commands = [
  { id: "workbench", label: "结果工作台 · 查看样例结果", key: "1", action: () => navigate("#/workbench/demo") },
  { id: "guide", label: "使用指南", key: "2", action: () => navigate("#/guide") },
  { id: "sound", label: "开关音效", key: "S", action: () => toggleSound() },
  { id: "perf", label: "开关性能模式", key: "P", action: () => togglePerformance() },
];

const ROUTES = {
  workbench: (id) => workbench.render(view, id),
  guide: () => guide.render(view),
};

async function renderRoute() {
  const { name, params } = parseRoute();
  setActiveNav(name);
  try {
    if (name === "workbench") {
      store.currentTaskId = "demo";
      await workbench.render(view, "demo");
    } else {
      await (ROUTES[name] || ROUTES.workbench)("demo");
    }
  } catch (err) {
    view.innerHTML = "";
    view.append(h("div", { class: "empty", html: `<div class="glyph">⚠</div><div class="title">页面加载失败</div><div>${esc(err.message)}</div>` }));
  }
}

function setActiveNav(name) {
  const normalized = name === "workbench" ? "workbench" : name;
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === normalized);
  });
}

function setupCommandPalette() {
  const palette = document.getElementById("command-palette");
  const input = document.getElementById("cmd-input");
  const results = document.getElementById("cmd-results");
  let selected = 0;

  const open = () => {
    palette.hidden = false;
    input.value = "";
    selected = 0;
    draw("");
    setTimeout(() => input.focus(), 10);
  };
  const close = () => { palette.hidden = true; };
  const draw = (q) => {
    const list = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
    results.innerHTML = "";
    list.forEach((c, i) => {
      const li = h("li", { class: i === selected ? "sel" : "" }, [
        h("span", { class: "k", text: c.key }),
        h("span", { text: c.label }),
      ]);
      li.addEventListener("click", () => { close(); c.action(); });
      results.append(li);
    });
  };

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      palette.hidden ? open() : close();
      return;
    }
    if (palette.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") { selected = Math.min(selected + 1, results.children.length - 1); draw(input.value); e.preventDefault(); }
    else if (e.key === "ArrowUp") { selected = Math.max(selected - 1, 0); draw(input.value); e.preventDefault(); }
    else if (e.key === "Enter") {
      const list = commands.filter((c) => c.label.toLowerCase().includes(input.value.toLowerCase()));
      list[selected]?.action();
      close();
    }
  });
  input.addEventListener("input", () => { selected = 0; draw(input.value); });
  palette.addEventListener("click", (e) => { if (e.target === palette) close(); });
  document.querySelector(".cmd-trigger").addEventListener("click", open);
}

function setupGlobalKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "Escape") {
      document.getElementById("command-palette").hidden = true;
      document.getElementById("modal-root").innerHTML = "";
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { "1": "#/workbench/demo", "2": "#/guide" };
    if (map[e.key]) {
      navigate(map[e.key]);
    }
  });
}

async function boot() {
  bindRipple();
  setupCommandPalette();
  setupGlobalKeys();
  applyFxSettings();

  document.getElementById("btn-sound").addEventListener("click", () => { toggleSound(); });
  document.getElementById("btn-perf").addEventListener("click", () => { togglePerformance(); });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.route === "workbench") navigate("#/workbench/demo");
      else navigate(`#/${btn.dataset.route}`);
    });
  });

  if (!location.hash) {
    location.hash = "#/workbench/demo";
  }

  window.addEventListener("hashchange", renderRoute);
  await renderRoute();
}

boot();
