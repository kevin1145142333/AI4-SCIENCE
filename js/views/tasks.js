// 任务中心：实时进度 / 取消 / 重试 / 进入工作台

import { api, watchTask } from "../api.js";
import { store, rememberTask, removeLocalTask, mergeTaskList } from "../store.js";
import { navigate } from "../router.js";
import { h, esc, toast, statusInfo, priorityInfo, depthInfo, fmtPct, badge, emptyState } from "../ui.js";
import { playSound } from "../fx.js";

const STAGES = [
  { label: "解析", min: 0 },
  { label: "检索", min: 0.1 },
  { label: "分析", min: 0.4 },
  { label: "图谱", min: 0.6 },
  { label: "TRL", min: 0.75 },
  { label: "假设", min: 0.8 },
  { label: "报告", min: 0.9 },
];

export async function render(view) {
  view.innerHTML = "";
  view.append(h("div", { class: "page-head", html: `
    <div class="section-kicker">Mission Control · 任务中心</div>
    <h1>研究任务队列</h1>
    <div class="lead">实时追踪每条研究流水线：解析、检索、分析、图谱、TRL、创新假设与报告。</div>
  ` }));

  const grid = h("div", { class: "task-grid" });
  view.append(grid);

  let serverOk = true;
  try {
    const res = await api.tasks();
    store.serverTasks = res.tasks || [];
  } catch (err) {
    serverOk = false;
    grid.append(h("div", { class: "empty", style: "grid-column:1/-1", html: `<div class="glyph">⚠</div><div class="title">无法连接服务</div><div>${esc(err.message)}</div>` }));
  }

  const tasks = serverOk ? mergeTaskList() : store.tasks.map((t) => ({ ...t, source: "local" }));
  if (!tasks.length) {
    grid.append(h("div", { style: "grid-column:1/-1", html: emptyState("◇", "暂无任务", "前往指挥舱发起你的第一条研究任务", `<div style="margin-top:14px"><button class="btn btn-primary" data-go="cockpit">去发起任务</button></div>`) }));
    grid.querySelector("[data-go='cockpit']")?.addEventListener("click", () => navigate("#/cockpit"));
  }

  for (const task of tasks) {
    const id = task.task_id || task.id;
    const isDemo = id === "demo" || id.startsWith("demo-");
    const card = renderCard(task, isDemo);
    grid.append(card);
    if (!isDemo && (task.status === "pending" || task.status === "running")) {
      watchTask(id, (status) => updateCard(card, { ...task, ...status }));
    }
  }

  view.append(h("div", { class: "dim", style: "margin-top:18px;font-size:12px", text: "提示：任务记录同时保存在浏览器本地与服务内存中；服务重启后，服务端任务会清空，但本地记录仍可显示。" }));
}

function renderCard(task, isDemo) {
  const id = task.task_id || task.id;
  const status = task.status || (isDemo ? "completed" : "pending");
  const si = statusInfo(status);
  const card = h("div", { class: "panel task-card", "data-id": id });
  card.innerHTML = `
    <div class="t-head">
      <span class="mono faint">#${esc(String(id).slice(0, 8))}</span>
      <span class="badge ${si.cls}"><span class="status-dot ${status}"></span>${si.label}</span>
    </div>
    <div class="t-query">${esc(task.query || "（无标题）")}</div>
    <div class="t-meta">
      ${badge(priorityInfo(task.priority).label, priorityInfo(task.priority).cls)}
      ${badge(depthInfo(task.depth), "violet")}
      ${isDemo ? badge("演示", "green") : ""}
      <span class="faint mono" style="font-size:11px">${esc((task.created_at || task.createdAt || "").slice(0, 16).replace("T", " "))}</span>
    </div>
    <div class="progress"><i style="width:${fmtPct(isDemo ? 1 : task.progress || 0)}"></i></div>
    <div class="timeline">${timeline(status, isDemo ? 1 : task.progress || 0)}</div>
    <div class="t-actions"></div>
  `;
  const actions = card.querySelector(".t-actions");
  const viewBtn = h("button", { class: "btn btn-sm btn-violet", text: "查看结果", onclick: () => {
    store.currentTaskId = id;
    navigate(`#/workbench/${id}`);
  } });
  actions.append(viewBtn);
  if (!isDemo) {
    if (status === "pending" || status === "running") {
      actions.append(h("button", { class: "btn btn-sm btn-danger", text: "取消", onclick: async () => {
        try { await api.cancel(id); playSound("confirm"); toast("任务已取消", "ok"); render(document.getElementById("view")); }
        catch (e) { toast(e.message, "err"); }
      } }));
    } else {
      actions.append(h("button", { class: "btn btn-sm", text: "删除记录", onclick: () => {
        removeLocalTask(id);
        playSound();
        render(document.getElementById("view"));
      } }));
    }
  }
  return card;
}

function updateCard(card, task) {
  const si = statusInfo(task.status);
  card.innerHTML = "";
  card.append(...renderCard(task, false).children);
}

function timeline(status, progress) {
  const done = status === "completed";
  return STAGES.map((s) => {
    let cls = "";
    if (done) cls = "done";
    else if (status === "running" && progress >= s.min) cls = "current";
    return `<div class="stage ${cls}"><div class="node"></div><div class="lbl">${s.label}</div></div>`;
  }).join("");
}
