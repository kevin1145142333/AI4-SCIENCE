// 结果工作台：指标 / 文献 / 图表 / 图谱 / TRL / 创新假设 / 报告

import { api } from "../api.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { h, esc, toast, badge, modal, fmtInt, fmtPct, depthInfo } from "../ui.js";
import { renderMarkdown } from "../markdown.js";
import { barChart, hBarChart, donutChart, scatterChart, trlGauge, sparkline } from "../charts.js";
import { ForceGraph } from "../graph.js";

let activeGraph = null;

export async function render(view, taskId) {
  view.innerHTML = "";
  activeGraph?.destroy();
  activeGraph = null;

  const isDemo = taskId === "demo" || taskId.startsWith("demo-");
  let status, result;

  if (isDemo) {
    const res = await fetch("demo/demo_result.json");
    result = await res.json();
    status = { status: "completed", progress: 1, query: result.query || "演示任务" };
  } else {
    try {
      status = await api.status(taskId);
    } catch (e) {
      view.append(h("div", { class: "empty", html: `<div class="glyph">⚠</div><div class="title">任务不存在</div><div>${esc(e.message)}</div>` }));
      return;
    }
    if (status.status === "pending" || status.status === "running") {
      view.append(h("div", { class: "empty", html: `<div class="glyph">◌</div><div class="title">任务尚未完成</div><div>当前进度 ${fmtPct(status.progress)}，请稍后刷新。</div><div style="margin-top:14px"><button class="btn btn-primary" data-refresh>刷新状态</button></div>` }));
      view.querySelector("[data-refresh]")?.addEventListener("click", () => render(view, taskId));
      return;
    }
    if (status.status === "failed" || status.status === "cancelled") {
      view.append(h("div", { class: "empty", html: `<div class="glyph">✕</div><div class="title">任务${status.status === "failed" ? "失败" : "已取消"}</div><div>${esc((status.errors || []).join("；"))}</div>` }));
      return;
    }
    try {
      result = await api.result(taskId);
    } catch (e) {
      view.append(h("div", { class: "empty", html: `<div class="glyph">⚠</div><div class="title">无法读取结果</div><div>${esc(e.message)}</div>` }));
      return;
    }
  }

  const papers = result.literature?.papers || [];
  const analysis = result.analysis || {};
  const stats = analysis.statistics || {};
  const graph = result.knowledge_graph || {};
  const trl = result.trl_assessment || {};
  const feas = result.feasibility || {};
  const innov = result.innovations || {};

  view.append(
    h("div", { class: "page-head", html: `
      <div class="section-kicker">Workbench · 结果工作台</div>
      <h1>${esc(status.query || result.query || "研究任务结果")}</h1>
      <div class="lead">
        ${badge(depthInfo(status.depth), "violet")}
        ${isDemo ? badge("演示数据", "green") : ""}
        <span class="faint mono" style="margin-left:8px">#${esc(taskId.slice(0, 8))}</span>
      </div>
    ` })
  );

  const toolbar = h("div", { class: "wb-toolbar" });
  toolbar.append(h("span", { class: "grow" }));
  toolbar.append(h("button", { class: "btn btn-sm", text: "下载报告 MD", onclick: () => downloadReport(taskId, isDemo, "markdown") }));
  toolbar.append(h("button", { class: "btn btn-sm", text: "预览 HTML", onclick: () => previewHtml(taskId, isDemo) }));
  if (!isDemo) toolbar.append(h("button", { class: "btn btn-sm", text: "返回任务中心", onclick: () => navigate("#/tasks") }));
  view.append(toolbar);

  view.append(renderMetrics(papers, stats, graph, trl, feas, innov));

  // 报告直接内嵌在结果页（排在概览下面），无需下载即可阅读
  const reportHost = h("div", { class: "report-slot" }, [
    h("div", { class: "dim", text: "正在加载报告…" }),
  ]);
  view.append(section("研究报告", reportHost));
  renderReport(reportHost, taskId, isDemo);

  // 知识图谱
  view.append(section("知识图谱", renderGraph(graph, papers)));

  // 图表
  view.append(section("数据分析", renderCharts(papers, analysis, result.literature || {})));

  // 文献
  view.append(section("文献清单", renderLiterature(papers)));

  // TRL 与可行性
  view.append(section("技术成熟度 TRL", renderTrl(trl, feas)));

  // 创新建议
  view.append(section("创新建议", renderInnovations(innov)));
}

function section(title, contentNode) {
  return h("div", { class: "section panel" }, [
    h("h2", { class: "panel-title", html: `${esc(title)} <span class="bar"></span>` }),
    contentNode,
  ]);
}

function cite(p) {
  return p.citationCount ?? p.citation_count ?? 0;
}

function renderMetrics(papers, stats, graph, trl, feas, innov) {
  const quality = papers.map((p) => p.quality_score || 0);
  const avgQ = quality.length ? (quality.reduce((a, b) => a + b, 0) / quality.length).toFixed(0) : "—";
  const items = [
    { label: "文献总数", value: papers.length, sub: `${analysisTotal(stats)} 篇已分析` },
    { label: "知识图谱", value: `${graph.nodes || 0} / ${graph.edges || 0}`, sub: "节点 / 边" },
    { label: "技术成熟度", value: trl.level ? `TRL ${trl.level}` : "—", sub: trl.confidence ? `置信度 ${fmtPct(trl.confidence)}` : "未评估" },
    { label: "创新建议", value: (innov.hypotheses?.length || 0) + (innov.cross_domain_transfers?.length || 0), sub: `平均质量分 ${avgQ}` },
  ];
  return h("div", { class: "grid-4" }, items.map((m) => h("div", { class: "metric", html: `<div class="m-label">${esc(m.label)}</div><div class="m-value">${esc(String(m.value))}</div><div class="m-sub">${esc(m.sub)}</div>` })));
}

function analysisTotal(stats) {
  return stats.total_papers ?? stats.total_analyzed ?? 0;
}

function renderGraph(graph, papers) {
  const wrap = h("div", {});
  const nodes = graph.graph_data?.nodes || [];
  const edges = graph.graph_data?.edges || [];
  if (!nodes.length) {
    wrap.innerHTML = `<div class="empty"><div class="glyph">◎</div><div class="title">暂无图谱数据</div><div>没有足够的文献用于构建引用 / 相似度关系。</div></div>`;
    return wrap;
  }

  const hud = h("div", { class: "graph-hud" });
  const colorBtn = h("select", { class: "select", style: "width:auto;padding:6px 10px;font-size:12px" }, [
    h("option", { value: "cluster", text: "按聚类着色", selected: "selected" }),
    h("option", { value: "year", text: "按年份着色" }),
    h("option", { value: "quality", text: "按质量着色" }),
  ]);
  const search = h("input", { class: "input", placeholder: "搜索节点…", style: "width:150px;padding:6px 10px;font-size:12px" });
  const fit = h("button", { class: "btn btn-sm", text: "复位视图" });
  hud.append(colorBtn, search, fit);

  const canvas = h("canvas");
  const graphBox = h("div", { class: "graph-wrap" }, [hud, canvas]);
  const legend = h("div", { class: "graph-legend", html: `<span><i class="sw" style="background:rgba(53,230,255,0.5)"></i>引用</span><span><i class="sw" style="background:rgba(160,107,255,0.5)"></i>相似度</span>` });
  const tip = h("div", { class: "graph-tip", text: "拖拽节点 · 滚轮缩放 · 拖拽空白平移 · 点击查看详情" });
  graphBox.append(legend, tip);
  wrap.append(graphBox);

  const detail = h("div", { class: "node-pop", hidden: true });
  graphBox.append(detail);

  requestAnimationFrame(() => {
    activeGraph = new ForceGraph(canvas, { nodes, edges }, {
      onSelect: (node) => {
        if (node) {
          detail.hidden = false;
          detail.innerHTML = `<b>${esc(node.label || node.id)}</b><div class="dim" style="margin-top:4px">年份 ${node.year || "—"} · 引用 ${node.citation_count || 0} · 质量 ${node.quality_score ?? "—"}</div>`;
        } else {
          detail.hidden = true;
        }
      },
    });
    colorBtn.addEventListener("change", () => activeGraph?.setColorMode(colorBtn.value));
    search.addEventListener("input", () => activeGraph?.setSearch(search.value.trim()));
    fit.addEventListener("click", () => activeGraph?.refit());
  });
  return wrap;
}

function renderCharts(papers, analysis, literature) {
  const wrap = h("div", { class: "grid-2" });
  const sources = analysisSources(literature, papers);
  const trends = analysis.trends || {};
  const yearly = trends.yearly_distribution || {};
  const years = Object.keys(yearly).sort();
  const keywords = (analysis.keywords || []).map((k) => ({
    label: k.term || k.keyword || "",
    value: Math.round((k.frequency ?? 0) * 100) || Math.round((k.tfidf_score || 0) * 100),
  })).filter((k) => k.label);
  const scatter = papers.map((p) => ({ x: p.year, y: p.quality_score || 0, r: cite(p), title: p.title })).filter((p) => p.x != null);

  wrap.append(panel("来源分布", donutChart(sources)));
  wrap.append(panel("年度发文分布", barChart({ labels: years, values: years.map((y) => yearly[y]) })));
  wrap.append(panel("研究关键词 Top 12", hBarChart({ items: keywords })));
  wrap.append(panel("质量 × 年份", scatterChart(scatter)));
  return wrap;
}

function panel(title, content) {
  const box = h("div", { class: "panel" }, [h("h3", { class: "panel-title", html: `${esc(title)} <span class="bar"></span>`, style: "margin-bottom:8px" })]);
  if (typeof content === "string") box.insertAdjacentHTML("beforeend", content);
  else box.append(content);
  return box;
}

function analysisSources(literature, papers) {
  const colors = { arxiv: "#35e6ff", pubmed: "#a06bff", semantic_scholar: "#38f0a0", ieee: "#ffc857", patent: "#ff5a8a" };
  const raw = literature.sources || null;
  const counts = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) counts[k] = Number(v) || 0;
  } else {
    for (const p of papers) {
      const s = (p.source || "其他").toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([k, v]) => ({ label: k, value: v, color: colors[k] || "#8fa6c8" }));
}

function renderLiterature(papers) {
  const wrap = h("div", {});
  if (!papers.length) {
    wrap.innerHTML = `<div class="empty"><div class="glyph">▤</div><div class="title">暂无文献</div><div>文献检索可能因网络或数据源限制返回空结果。</div></div>`;
    return wrap;
  }
  let page = 0, pageSize = 20;
  let sortKey = "quality_score", sortDir = -1;
  let query = "", source = "";

  const sources = [...new Set(papers.map((p) => p.source || "其他"))];
  const toolbar = h("div", { class: "wb-toolbar" });
  const search = h("input", { class: "input", placeholder: "搜索标题 / 摘要…", style: "max-width:240px" });
  const srcSel = h("select", { class: "select", style: "max-width:160px" }, [
    h("option", { value: "", text: "全部来源" }),
    ...sources.map((s) => h("option", { value: s, text: s })),
  ]);
  const exportBtn = h("button", { class: "btn btn-sm", text: "导出 CSV" });
  toolbar.append(search, srcSel, exportBtn);
  wrap.append(toolbar);

  const tableWrap = h("div", { class: "table-wrap" });
  wrap.append(tableWrap);
  const pager = h("div", { class: "dim", style: "margin-top:10px;font-size:12px" });
  wrap.append(pager);

  const filtered = () => papers.filter((p) => {
    const text = `${p.title || ""} ${p.abstract || ""}`.toLowerCase();
    const okQ = !query || text.includes(query.toLowerCase());
    const okS = !source || (p.source || "其他") === source;
    return okQ && okS;
  }).sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
    return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir;
  });

  const draw = () => {
    const data = filtered();
    const total = data.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pages - 1);
    const slice = data.slice(page * pageSize, page * pageSize + pageSize);
    const th = (key, label) => `<th class="sortable" data-key="${key}">${label}</th>`;
    tableWrap.innerHTML = `<table class="data">
      <thead><tr>${th("title", "标题")}${th("year", "年份")}${th("source", "来源")}${th("citationCount", "引用")}${th("quality_score", "质量")}</tr></thead>
      <tbody>${slice.map(rowHtml).join("")}</tbody>
    </table>`;
    pager.textContent = `共 ${total} 篇 · 第 ${page + 1} / ${pages} 页`;
    tableWrap.querySelectorAll("th.sortable").forEach((t) => t.addEventListener("click", () => {
      const key = t.dataset.key;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = -1; }
      draw();
    }));
    tableWrap.querySelectorAll("tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        const id = tr.dataset.id;
        const p = papers.find((x) => String(x.paperId || x.title) === id);
        if (p) modal({ title: "文献详情", content: h("div", { html: `<div style="margin-bottom:8px"><b>${esc(p.title || "无标题")}</b></div><div class="dim" style="font-size:12px">${esc((p.authors || []).slice(0, 6).join("、"))} · ${p.year || "—"} · ${esc(p.source || "")}</div><div class="dim" style="margin-top:10px;font-size:13px">${esc(p.abstract || "无摘要")}</div>` }) });
      });
    });
  };

  search.addEventListener("input", () => { query = search.value; page = 0; draw(); });
  srcSel.addEventListener("change", () => { source = srcSel.value; page = 0; draw(); });
  exportBtn.addEventListener("click", () => exportCsv(papers));
  draw();
  return wrap;
}

function rowHtml(p) {
  const id = String(p.paperId || p.title);
  return `<tr data-id="${esc(id)}">
    <td>${esc((p.title || "无标题").slice(0, 110))}</td>
    <td class="mono">${p.year || "—"}</td>
    <td>${esc(p.source || "—")}</td>
    <td class="mono">${fmtInt(cite(p))}</td>
    <td class="mono accent">${p.quality_score != null ? p.quality_score.toFixed(0) : "—"}</td>
  </tr>`;
}

function exportCsv(papers) {
  const head = ["title", "year", "source", "citation_count", "quality_score", "authors"];
  const rows = papers.map((p) => [
    `"${String(p.title || "").replaceAll('"', '""')}"`,
    p.year ?? "",
    p.source ?? "",
    cite(p),
    p.quality_score ?? "",
    `"${(p.authors || []).join("; ").replaceAll('"', '""')}"`,
  ]);
  const csv = [head.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = h("a", { href: URL.createObjectURL(blob), download: "ai4_science_papers.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
}

function renderTrl(trl, feas) {
  const wrap = h("div", {});
  wrap.append(h("div", { class: "panel", style: "margin-bottom:14px", html: trlGauge({ level: trl.level, confidence: trl.confidence, distribution: trl.distribution }) }));
  if (feas && Object.keys(feas).length) {
    const res = feas.resource_estimate || {};
    wrap.append(h("div", { class: "grid-3" }, [
      metricSmall("可行性", feas.feasibility || "—"),
      metricSmall("风险等级", feas.risk_level || "—"),
      metricSmall("时间线", feas.timeline || "—"),
    ]));
    if (feas.recommendation) {
      wrap.append(h("div", { class: "panel", style: "margin-top:14px", html: `<div class="m-label">专家建议</div><div style="margin-top:6px">${esc(feas.recommendation)}</div>` }));
    }
  }
  if (trl.evidence?.length) {
    const list = h("ul", { style: "margin:12px 0 0;padding-left:18px" });
    for (const ev of trl.evidence) list.append(h("li", { class: "dim", text: typeof ev === "string" ? ev : ev.title || JSON.stringify(ev) }));
    wrap.append(list);
  }
  return wrap;
}

function metricSmall(label, value) {
  return h("div", { class: "metric", html: `<div class="m-label">${esc(label)}</div><div class="m-value" style="font-size:18px">${esc(String(value))}</div>` });
}

function renderInnovations(innov) {
  const wrap = h("div", {});
  const hyps = innov.hypotheses || [];
  if (!hyps.length && !(innov.cross_domain_transfers || []).length) {
    wrap.innerHTML = `<div class="empty"><div class="glyph">◈</div><div class="title">未生成创新建议</div></div>`;
    return wrap;
  }
  if (hyps.length) {
    const list = h("div", { class: "card-list" });
    for (const hp of hyps) list.append(renderHypothesis(hp));
    wrap.append(h("h3", { class: "dim", style: "letter-spacing:2px", text: `创新假设（${hyps.length}）` }));
    wrap.append(list);
  }
  const cfs = innov.counterfactual_reasoning || [];
  if (cfs.length) {
    wrap.append(h("h3", { class: "dim", style: "margin-top:22px;letter-spacing:2px", text: "反事实推理" }));
    const cfWrap = h("div", { class: "card-list" });
    for (const group of cfs) cfWrap.append(renderCounterfactual(group));
    wrap.append(cfWrap);
  }
  const transfers = innov.cross_domain_transfers || [];
  if (transfers.length) {
    wrap.append(h("h3", { class: "dim", style: "margin-top:22px;letter-spacing:2px", text: "跨域迁移推荐" }));
    const tWrap = h("div", { class: "grid-2" });
    for (const t of transfers) tWrap.append(renderTransfer(t));
    wrap.append(tWrap);
  }
  return wrap;
}

function renderHypothesis(hp) {
  const feas = hp.feasibility || {};
  return h("div", { class: "panel hyp-card", html: `
    <div class="h-title">${esc(hp.title || "未命名假设")}</div>
    <div class="dim" style="font-size:13px">${esc(hp.description || "")}</div>
    <div class="dim" style="margin-top:8px;font-size:12px">依据：${esc(hp.rationale || "—")}</div>
    <div class="feas-tri">
      <div class="f"><b>${esc(feas.technical || "—")}</b>技术可行性</div>
      <div class="f"><b>${esc(feas.resource || "—")}</b>资源可行性</div>
      <div class="f"><b>${esc(feas.time || "—")}</b>时间可行性</div>
    </div>
    <div class="t-meta" style="margin-top:10px">${badge(hp.expected_impact || "—", "violet")}${badge("置信度 " + (hp.confidence != null ? Math.round(hp.confidence * 100) + "%" : "—"), "cyan")}${hp.timeline ? badge(hp.timeline, "gray") : ""}</div>
  ` });
}

function renderCounterfactual(group) {
  const scenarios = group.scenarios || [];
  const rows = scenarios.map((s) => `<tr><td>${esc(s.scenario || s.id || "")}</td><td>${esc(s.condition_change || "—")}</td><td>${esc(s.expected_outcome || "—")}</td><td class="mono">${s.success_probability != null ? Math.round(s.success_probability * 100) + "%" : "—"}</td><td>${esc((s.risks || []).join("；") || "—")}</td></tr>`).join("");
  return h("div", { class: "panel", html: `
    <div class="m-label">假设 ${esc(group.hypothesis_id || "")}</div>
    <div class="table-wrap" style="margin-top:10px"><table class="data cf-table"><thead><tr><th>场景</th><th>条件变化</th><th>预期结果</th><th>成功概率</th><th>风险</th></tr></thead><tbody>${rows}</tbody></table></div>
  ` });
}

function renderTransfer(t) {
  return h("div", { class: "panel", html: `
    <div class="m-label" style="color:var(--violet)">跨域迁移</div>
    <div style="margin-top:8px"><b>${esc(t.source_domain || "源领域")}</b> → <b>${esc(t.target_domain || "目标领域")}</b></div>
    <div class="dim" style="margin-top:6px;font-size:13px">${esc(t.transfer_method || t.method || t.description || "—")}</div>
    ${(t.implementation_steps || []).length ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:12.5px">${t.implementation_steps.map((s) => `<li class="dim">${esc(typeof s === "string" ? s : s.description || s.step || "")}</li>`).join("")}</ul>` : ""}
    ${t.expected_benefit ? `<div class="dim" style="margin-top:6px;font-size:12px">预期收益：${esc(t.expected_benefit)}</div>` : ""}
  ` });
}

// 任务刚结束时报告文件可能还差一瞬间才落地，这里重试几次再报错
async function loadReportMarkdown(taskId, isDemo, attempts = 4) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      if (isDemo) {
        const res = await fetch("demo/demo_report.md");
        const text = await res.text();
        if (text.trim()) return text;
        lastError = new Error("演示报告为空");
      } else {
        const data = await api.report(taskId, "markdown");
        const text = data.content || "";
        if (text.trim()) return text;
        lastError = new Error("报告内容为空");
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("报告尚未生成");
}

async function renderReport(host, taskId, isDemo) {
  let md = "";
  try {
    md = await loadReportMarkdown(taskId, isDemo);
  } catch (e) {
    host.innerHTML = `<div class="empty"><div class="glyph">▤</div><div class="title">报告尚未生成</div><div>${esc(e.message)}</div></div>`;
    return;
  }

  let body;
  try {
    body = h("div", { class: "report-body inline" });
    body.innerHTML = renderMarkdown(md);
  } catch (e) {
    host.innerHTML = `<div class="empty"><div class="glyph">▤</div><div class="title">报告渲染失败</div><div>${esc(e.message)}</div></div>`;
    return;
  }

  host.innerHTML = "";
  host.append(
    h("div", { class: "report-actions" }, [
      h("span", { class: "dim", style: "font-size:12px", text: "报告已内嵌显示，可直接阅读或滚动查看全文" }),
      h("span", { class: "grow" }),
      h("button", {
        class: "btn btn-sm",
        text: "下载 Markdown",
        onclick: () => downloadReport(taskId, isDemo, "markdown"),
      }),
      h("button", {
        class: "btn btn-sm",
        text: "在新窗口打开",
        onclick: () => openReportWindow(taskId, isDemo),
      }),
    ])
  );
  host.append(body);
}

function downloadReport(taskId, isDemo, format) {
  if (isDemo) {
    const a = h("a", { href: "demo/demo_report.md", download: "AI4_Science_演示报告.md" });
    a.click();
    return;
  }
  api.report(taskId, format).then((data) => {
    const ext = format === "markdown" ? "md" : "html";
    const blob = new Blob([data.content], { type: "text/plain;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: data.filename || `report_${taskId}.${ext}` });
    a.click();
    URL.revokeObjectURL(a.href);
  }).catch((e) => toast(e.message, "err"));
}

async function previewHtml(taskId, isDemo) {
  let html = "";
  try {
    if (isDemo) {
      const res = await fetch("demo/demo_report.md");
      html = renderMarkdown(await res.text());
    } else {
      const data = await api.report(taskId, "html");
      html = data.content || "";
    }
  } catch (e) {
    toast(e.message, "err");
    return;
  }
  const iframe = h("iframe", {
    style: "width:100%;height:62vh;border:1px solid var(--line);border-radius:8px",
  });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  iframe.src = URL.createObjectURL(blob);
  iframe.addEventListener("load", () => URL.revokeObjectURL(iframe.src), { once: true });
  modal({
    title: "HTML 报告预览",
    content: iframe,
  });
}

function wrapHtmlDocument(inner) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI4 Science 研究报告</title>
<style>
  body{font-family:system-ui,"Microsoft YaHei",Arial,sans-serif;max-width:980px;margin:0 auto;padding:28px;line-height:1.75;color:#1f2933}
  h1{font-size:24px;border-bottom:2px solid #3498db;padding-bottom:10px}
  h2{font-size:19px;color:#2c3e50;margin-top:28px}
  h3{font-size:16px;color:#516070}
  table{border-collapse:collapse;width:100%;margin:16px 0}
  th,td{border:1px solid #d5dbe2;padding:8px 10px;text-align:left;font-size:13px}
  th{background:#eef4fb}
  code{background:#f2f5f8;padding:2px 5px;border-radius:3px}
</style></head><body>${inner}</body></html>`;
}

// 在新标签页里打开完整报告（不需要下载文件）
async function openReportWindow(taskId, isDemo) {
  let html = "";
  try {
    if (isDemo) {
      const res = await fetch("demo/demo_report.md");
      html = renderMarkdown(await res.text());
    } else {
      const data = await api.report(taskId, "html");
      html = data.content || "";
    }
  } catch (e) {
    toast(e.message, "err");
    return;
  }

  if (!html.trim()) {
    toast("报告内容为空", "err");
    return;
  }
  if (!/<\s*html/i.test(html)) html = wrapHtmlDocument(html);
  // 报告由本地生成，仍去掉脚本，避免历史数据里夹带可执行内容
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");

  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const win = window.open(url, "_blank");
  if (!win) {
    toast("浏览器拦截了新窗口，可改用下载按钮", "err");
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
