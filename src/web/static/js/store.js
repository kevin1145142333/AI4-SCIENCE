// 轻量状态与 localStorage 持久化

const LS = {
  settings: "ai4_science.settings",
  tasks: "ai4_science.tasks",
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}

export const store = {
  settings: load(LS.settings, {
    sound: false,
    particles: true,
    density: "cozy",
    performance: false,
  }),
  tasks: load(LS.tasks, []),
  serverTasks: [],
  currentTaskId: null,
};

export function persistSettings() {
  save(LS.settings, store.settings);
}

export function rememberTask(task) {
  const existing = store.tasks.find((t) => t.id === task.id);
  if (!existing) {
    store.tasks.unshift(task);
  } else {
    Object.assign(existing, task);
  }
  if (store.tasks.length > 80) store.tasks.length = 80;
  save(LS.tasks, store.tasks);
}

export function removeLocalTask(id) {
  store.tasks = store.tasks.filter((t) => t.id !== id);
  save(LS.tasks, store.tasks);
}

export function getLocalTask(id) {
  return store.tasks.find((t) => t.id === id);
}

export function mergeTaskList() {
  const map = new Map();
  for (const t of store.tasks) {
    map.set(t.id, { ...t, source: "local" });
  }
  for (const t of store.serverTasks) {
    if (map.has(t.task_id)) {
      const local = map.get(t.task_id);
      map.set(t.task_id, { ...local, ...t, source: "server" });
    } else {
      map.set(t.task_id, { ...t, source: "server" });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const at = a.created_at || a.createdAt || "";
    const bt = b.created_at || b.createdAt || "";
    return bt.localeCompare(at);
  });
}

export function isDemoTask(id) {
  return typeof id === "string" && (id === "demo" || id.startsWith("demo-"));
}
