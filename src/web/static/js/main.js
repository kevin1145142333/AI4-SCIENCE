// 应用入口：路由 / 导航 / 命令面板 / 全局交互

import { api } from "./api.js";
import { store, rememberTask, persistSettings } from "./store.js";
import { parseRoute, navigate } from "./router.js";
import { h, esc, toast } from "./ui.js";
import { applyFxSettings, bindRipple, toggleSound, togglePerformance, playSound } from "./fx.js";

import * as cockpit from "./views/cockpit.js?v=20261016b";
import * as tasks from "./views/tasks.js?v=20261016b";
import * as workbench from "./views/workbench.js?v=20261016b";
import * as system from "./views/system.js?v=20261016b";
import * as guide from "./views/guide.js?v=20261016b";

const view = document.getElementById("view");
const commands = [
  { id: "cockpit", label: "指挥舱 · 发起研究任务", key: "1", action: () => navigate("#/cockpit") },
  { id: "tasks", label: "任务中心 · 查看任务队列", key: "2", action: () => navigate("#/tasks") },
  { id: "workbench", label: "结果工作台 · 查看结果", key: "3", action: () => goWorkbench() },
  { id: "system", label: "系统监控 · 运行遥测", key: "4", action: () => navigate("#/system") },
  { id: "guide", label: "使用指南", key: "5", action: () => navigate("#/guide") },
  { id: "demo", label: "加载演示数据", key: "D", action: () => loadDemo() },
  { id: "sound", label: "开关音效", key: "S", action: () => toggleSound() },
  { id: "perf", label: "开关性能模式", key: "P", action: () => togglePerformance() },
];

const ROUTES = {
  cockpit: () => cockpit.render(view),
  tasks: () => tasks.render(view),
  workbench: (id) => workbench.render(view, id),
  system: () => system.render(view),
  guide: () => guide.render(view),
};

async function renderRoute() {
  const { name, params } = parseRoute();
  setActiveNav(name);
  try {
    if (name === "workbench") {
      await goWorkbench(params[0]);
    } else {
      await (ROUTES[name] || ROUTES.cockpit)();
    }
  } catch (err) {
    view.innerHTML = "";
    view.append(h("div", { class: "empty", html: `<div class="glyph">⚠</div><div class="title">页面加载失败</div><div>${esc(err.message)}</div>` }));
  }
}

async function goWorkbench(id) {
  if (id) {
    store.currentTaskId = id;
    return workbench.render(view, id);
  }
  // 优先使用最近一次任务；否则弹出选择器
  const last = store.currentTaskId || store.tasks[0]?.id;
  if (last) return workbench.render(view, last);
  navigate("#/tasks");
  toast("请先选择一个任务", "warn");
}

function setActiveNav(name) {
  const normalized = name === "workbench" ? "workbench" : name;
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === normalized);
  });
}

async function loadDemo() {
  try {
    const res = await fetch("/demo/demo_result.json");
    const data = await res.json();
    const id = "demo";
    rememberTask({ id, query: data.query || "演示任务", createdAt: new Date().toISOString(), demo: true });
    store.currentTaskId = id;
    playSound("confirm");
    toast("演示数据已加载", "ok");
    navigate(`#/workbench/${id}`);
  } catch (err) {
    toast("演示数据加载失败：" + err.message, "err");
  }
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
    const map = { "1": "#/cockpit", "2": "#/tasks", "3": "#/tasks", "4": "#/system", "5": "#/guide" };
    if (map[e.key]) {
      if (e.key === "3") goWorkbench();
      else navigate(map[e.key]);
    }
  });
}

async function boot() {
  bindRipple();
  setupCommandPalette();
  setupGlobalKeys();
  applyFxSettings();

  document.getElementById("btn-demo").addEventListener("click", loadDemo);
  document.getElementById("btn-sound").addEventListener("click", () => { toggleSound(); });
  document.getElementById("btn-perf").addEventListener("click", () => { togglePerformance(); });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.route === "workbench") goWorkbench();
      else navigate(`#/${btn.dataset.route}`);
    });
  });

  try {
    const info = await api.system();
    document.getElementById("footer-version").textContent = info.version || "1.0.0";
  } catch {
    /* 离线时保留默认版本号 */
  }

  window.addEventListener("hashchange", renderRoute);
  await renderRoute();
}

boot();
