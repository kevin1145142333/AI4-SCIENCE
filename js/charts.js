// 纯 SVG 图表（无第三方库）

function esc(v) {
  return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const C = { cyan: "#35e6ff", violet: "#a06bff", magenta: "#ff5a8a", green: "#38f0a0", amber: "#ffc857", dim: "#5c6f91" };

export function barChart({ labels = [], values = [], color = C.cyan, width = 560, height = 230 }) {
  if (!labels.length) return '<div class="faint" style="text-align:center;padding:40px">暂无数据</div>';
  const padL = 34, padB = 34, padT = 16, padR = 12;
  const max = Math.max(...values, 1);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const step = innerW / labels.length;
  const bw = Math.min(44, step * 0.58);
  let bars = "";
  labels.forEach((label, idx) => {
    const v = values[idx] || 0;
    const bh = (v / max) * innerH;
    const x = padL + idx * step + (step - bw) / 2;
    const y = padT + innerH - bh;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(bh, 0.5).toFixed(1)}" fill="${color}" opacity="0.85"><title>${esc(label)}: ${v}</title></rect>`;
    bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${(padT + innerH + 16).toFixed(1)}" text-anchor="middle" fill="${C.dim}" font-size="10">${esc(label)}</text>`;
  });
  const grid = [0, 0.5, 1].map((p) => {
    const y = padT + innerH * (1 - p);
    const val = Math.round(max * p);
    return `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="rgba(92,140,205,0.18)"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="${C.dim}" font-size="10">${val}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${grid}${bars}</svg>`;
}

export function hBarChart({ items = [], color = C.cyan, width = 520, height = 280, topN = 12 }) {
  const data = items.slice(0, topN);
  if (!data.length) return '<div class="faint" style="text-align:center;padding:40px">暂无数据</div>';
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowH = height / data.length;
  const labelW = 130;
  let rows = "";
  data.forEach((d, idx) => {
    const y = idx * rowH + rowH / 2;
    const bw = Math.max(4, ((d.value / max) * (width - labelW - 56)));
    rows += `<text x="${labelW - 8}" y="${y + 4}" text-anchor="end" fill="${C.dim}" font-size="11">${esc(d.label)}</text>`;
    rows += `<rect x="${labelW}" y="${y - 8}" width="${bw}" height="${rowH - 14}" fill="${color}" opacity="0.82"><title>${esc(d.label)}: ${d.value}</title></rect>`;
    rows += `<text x="${labelW + bw + 8}" y="${y + 4}" fill="${C.dim}" font-size="10">${d.value}</text>`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${rows}</svg>`;
}

export function donutChart(items = []) {
  const data = items.filter((d) => d.value > 0);
  if (!data.length) return '<div class="faint" style="text-align:center;padding:40px">暂无数据</div>';
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const R = 72, r = 46, cx = 100, cy = 100;
  let angle = -Math.PI / 2;
  let segs = "";
  data.forEach((d) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + sweep);
    const y2 = cy + R * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    segs += `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${d.color}" opacity="0.9"><title>${esc(d.label)}: ${d.value}</title></path>`;
    angle += sweep;
  });
  const legend = data.map((d) => `<span><i class="sw" style="background:${d.color}"></i>${esc(d.label)} · ${d.value}</span>`).join("");
  return `<div style="display:flex;align-items:center;gap:14px"><svg viewBox="0 0 200 200" width="200" height="200" role="img">${segs}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#070c1a"/><text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#eaffff" font-size="22" font-family="ui-monospace,monospace">${total}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="${C.dim}" font-size="10">文献来源</text></svg><div class="chart-legend" style="flex-direction:column;margin:0">${legend}</div></div>`;
}

export function scatterChart(points = []) {
  const data = points.filter((p) => p.x != null && p.y != null).slice(0, 400);
  if (!data.length) return '<div class="faint" style="text-align:center;padding:40px">暂无数据</div>';
  const width = 520, height = 260;
  const padL = 40, padB = 34, padT = 14, padR = 16;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 100);
  const rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1;
  const dots = data.map((d) => {
    const px = padL + ((d.x - minX) / rangeX) * (width - padL - padR);
    const py = padT + (1 - (d.y - minY) / rangeY) * (height - padT - padB);
    const r = Math.min(14, 3 + (d.r || 0) / 80);
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${C.violet}" opacity="0.7"><title>${esc(d.title || "")} · ${d.x} · 质量 ${d.y}</title></circle>`;
  }).join("");
  const axis = `<line x1="${padL}" y1="${height - padB}" x2="${width - padR}" y2="${height - padB}" stroke="rgba(92,140,205,0.4)"/><line x1="${padL}" y1="${padT}" x2="${padL}" y2="${height - padB}" stroke="rgba(92,140,205,0.4)"/>`;
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${axis}${dots}<text x="${width - padR}" y="${height - padB + 18}" text-anchor="end" fill="${C.dim}" font-size="10">年份 ${minX}–${maxX}</text><text x="${padL - 6}" y="${padT + 8}" text-anchor="end" fill="${C.dim}" font-size="10">质量分</text></svg>`;
}

export function trlGauge({ level = 0, confidence = 0, distribution = {} }) {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const names = ["基本原理", "概念形成", "实验验证", "实验室验证", "相关环境验证", "模拟环境演示", "实际环境演示", "系统完成", "实际应用"];
  const bars = levels.map((n) => {
    const lit = n <= level ? "lit" : "";
    const share = distribution && distribution[n] ? Math.round(distribution[n] * 100) + "%" : "";
    return `<div class="trl-stage ${lit}" title="TRL ${n} · ${esc(names[n - 1])}${share ? " · " + share : ""}"><span class="n">${n}</span><span class="bar"></span></div>`;
  }).join("");
  return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between">${bars}</div>
    <div class="dim" style="margin-top:12px">当前等级 <b class="accent">TRL ${level}</b>（${esc(names[(level || 1) - 1] || "数据不足")}） · 置信度 <b class="accent">${Math.round((confidence || 0) * 100)}%</b></div>`;
}

export function sparkline(values = [], { color = C.cyan, width = 520, height = 80 } = {}) {
  if (values.length < 2) values = [0, 0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = (max - min) || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${height} ${pts.join(" ")} ${width},${height}`;
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" role="img">
    <polygon points="${area}" fill="${color}" opacity="0.12"/>
    <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="1.6"/>
  </svg>`;
}
