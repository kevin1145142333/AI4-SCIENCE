// DOM 构建与通用界面工具

export function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== false && value !== null && value !== undefined) {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function fmtInt(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function fmtPct(value) {
  return (Number(value || 0) * 100).toFixed(0) + "%";
}

export function statusInfo(status) {
  const map = {
    pending: { label: "等待中", cls: "amber" },
    running: { label: "运行中", cls: "cyan" },
    completed: { label: "已完成", cls: "green" },
    failed: { label: "失败", cls: "red" },
    cancelled: { label: "已取消", cls: "red" },
  };
  return map[status] || { label: status || "未知", cls: "gray" };
}

export function priorityInfo(priority) {
  const map = {
    LOW: { label: "低", cls: "gray" },
    MEDIUM: { label: "中", cls: "cyan" },
    HIGH: { label: "高", cls: "violet" },
    URGENT: { label: "紧急", cls: "red" },
  };
  return map[priority] || { label: priority || "中", cls: "gray" };
}

export function depthInfo(depth) {
  const map = { quick: "快速", standard: "标准", comprehensive: "全面" };
  return map[depth] || depth || "全面";
}

export function badge(text, cls = "cyan") {
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

export function toast(message, kind = "info", duration = 3200) {
  const root = document.getElementById("toasts");
  const node = h("div", { class: `toast ${kind}`, text: message });
  root.append(node);
  setTimeout(() => {
    node.style.transition = "opacity 220ms ease";
    node.style.opacity = "0";
    setTimeout(() => node.remove(), 240);
  }, duration);
}

export function modal({ title, content, actions = [] }) {
  const root = document.getElementById("modal-root");
  const backdrop = h("div", { class: "modal-backdrop" });
  const box = h("div", { class: "modal" });
  const head = h("div", { class: "modal-head" });
  head.append(h("h3", { text: title }));
  const close = h("button", {
    class: "btn btn-sm",
    text: "关闭",
    onclick: () => backdrop.remove(),
  });
  head.append(close);
  box.append(head);
  box.append(content);
  if (actions.length) {
    const row = h("div", { class: "cockpit-actions" });
    for (const a of actions) {
      row.append(
        h("button", {
          class: `btn ${a.cls || ""}`,
          text: a.label,
          onclick: () => {
            backdrop.remove();
            a.onClick && a.onClick();
          },
        })
      );
    }
    box.append(row);
  }
  backdrop.append(box);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  root.append(backdrop);
  return backdrop;
}

export function emptyState(glyph, title, sub, actionHtml = "") {
  return `<div class="empty">
    <div class="glyph">${glyph}</div>
    <div class="title">${esc(title)}</div>
    ${sub ? `<div class="faint">${esc(sub)}</div>` : ""}
    ${actionHtml}
  </div>`;
}
