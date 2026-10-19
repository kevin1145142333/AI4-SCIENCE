// 系统监控：设备 / 资源曲线 / 日志

import { api } from "../api.js";
import { h, esc } from "../ui.js";
import { sparkline } from "../charts.js";

const HISTORY = 60;
const cpuHist = [];
const memHist = [];

export async function render(view) {
  view.innerHTML = "";
  view.append(h("div", { class: "page-head", html: `
    <div class="section-kicker">Telemetry · 系统监控</div>
    <h1>运行遥测</h1>
    <div class="lead">实时设备信息、资源占用与最新日志尾部。</div>
  ` }));

  let info;
  try {
    info = await api.system();
  } catch (e) {
    view.append(h("div", { class: "empty", html: `<div class="glyph">⚠</div><div class="title">无法读取系统信息</div><div>${esc(e.message)}</div>` }));
    return;
  }

  const dev = info.device || {};
  const res = info.resources || {};
  pushHist(res);

  const devPanel = h("div", { class: "panel" }, [
    h("h2", { class: "panel-title", html: "设备信息 <span class=\"bar\"></span>" }),
    h("div", { class: "grid-2", html: `
      <div class="metric"><div class="m-label">设备</div><div class="m-value" style="font-size:20px">${esc((dev.device || "cpu").toUpperCase())}</div></div>
      <div class="metric"><div class="m-label">CPU</div><div class="m-value" style="font-size:16px">${esc(dev.cpu_name || "—")}</div></div>
      <div class="metric"><div class="m-label">内存</div><div class="m-value" style="font-size:20px">${esc((dev.total_memory || 0).toFixed(1))} GB</div></div>
      <div class="metric"><div class="m-label">GPU</div><div class="m-value" style="font-size:16px">${dev.has_gpu ? esc(dev.gpu_name || "CUDA") : "未检测到"}</div></div>
    ` }),
  ]);

  const resPanel = h("div", { class: "panel" }, [
    h("h2", { class: "panel-title", html: "资源曲线（近 60 秒） <span class=\"bar\"></span>" }),
    h("div", { class: "grid-2" }, [
      h("div", { class: "metric", html: `<div class="m-label">CPU 使用率</div><div class="m-value" style="font-size:20px">${(res.cpu_percent ?? 0).toFixed(0)}%</div><div class="sys-spark">${sparkline(cpuHist)}</div>` }),
      h("div", { class: "metric", html: `<div class="m-label">内存使用率</div><div class="m-value" style="font-size:20px">${(res.memory_percent ?? 0).toFixed(0)}%</div><div class="sys-spark">${sparkline(memHist, { color: "#a06bff" })}</div>` }),
    ]),
    h("div", { class: "dim", style: "margin-top:10px;font-size:12px", text: `服务版本 ${info.version || "—"} · 服务器时间 ${esc((info.server_time || "").slice(0, 19).replace("T", " "))}` }),
  ]);

  view.append(h("div", { class: "grid-2" }, [devPanel, resPanel]));

  const logPanel = h("div", { class: "panel section" }, [
    h("h2", { class: "panel-title", html: "最新日志 <span class=\"bar\"></span>" }),
    h("div", { class: "sys-log", text: "正在加载日志…" }),
    h("div", { class: "wb-toolbar", style: "margin-top:10px" }, [
      h("button", { class: "btn btn-sm", text: "刷新日志", onclick: loadLogs }),
    ]),
  ]);
  view.append(logPanel);
  loadLogs();

  function loadLogs() {
    api.logs().then((data) => {
      logPanel.querySelector(".sys-log").textContent = (data.lines || []).join("\n") || "（暂无日志）";
    }).catch((e) => {
      logPanel.querySelector(".sys-log").textContent = "无法读取日志：" + e.message;
    });
  }
}

function pushHist(res) {
  cpuHist.push(Number(res.cpu_percent || 0));
  memHist.push(Number(res.memory_percent || 0));
  if (cpuHist.length > HISTORY) cpuHist.shift();
  if (memHist.length > HISTORY) memHist.shift();
}
