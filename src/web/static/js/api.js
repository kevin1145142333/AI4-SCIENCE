// /ui/api/* 同源接口封装 + 轮询调度

const API_BASE = "/ui/api";

let offline = false;

function setOffline(value) {
  offline = value;
  const banner = document.getElementById("offline-banner");
  if (banner) banner.hidden = !value;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (err) {
    setOffline(true);
    throw new Error("无法连接服务，请确认已启动 AI4 Science");
  }
  setOffline(false);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      /* 非 JSON 响应 */
    }
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export const api = {
  system: () => request("/system"),
  logs: () => request("/system/logs?lines=200"),
  submit: (payload) =>
    request("/research/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  tasks: () => request("/research/tasks"),
  status: (id) => request(`/research/status/${encodeURIComponent(id)}`),
  result: (id) => request(`/research/result/${encodeURIComponent(id)}`),
  cancel: (id) =>
    request(`/research/cancel/${encodeURIComponent(id)}`, { method: "DELETE" }),
  report: (id, format = "markdown") =>
    request(`/research/report/${encodeURIComponent(id)}?format=${format}`),
};

// 轮询调度器：任一任务处于 pending/running 时保持轮询，页面不可见时暂停
const pollers = new Map();

export function watchTask(id, cb, interval = 1500) {
  stopWatching(id);
  const timer = setInterval(async () => {
    if (document.hidden) return;
    try {
      const status = await api.status(id);
      cb(status);
      if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
        stopWatching(id);
      }
    } catch {
      stopWatching(id);
    }
  }, interval);
  pollers.set(id, timer);
}

export function stopWatching(id) {
  const timer = pollers.get(id);
  if (timer) {
    clearInterval(timer);
    pollers.delete(id);
  }
}

export function stopAllWatching() {
  for (const timer of pollers.values()) clearInterval(timer);
  pollers.clear();
}
