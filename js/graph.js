// 交互式力导向知识图谱（canvas 2D，无第三方库）

const PALETTE = ["#35e6ff", "#a06bff", "#ff5a8a", "#38f0a0", "#ffc857", "#7ff2ff", "#d98cff", "#ff8fb0"];

function yearColor(year, minY, maxY) {
  const t = maxY > minY ? (year - minY) / (maxY - minY) : 0.5;
  const from = [53, 230, 255];
  const to = [160, 107, 255];
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function qualityColor(q, maxQ) {
  const t = maxQ > 0 ? q / maxQ : 0;
  const from = [56, 240, 160];
  const to = [255, 90, 138];
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function labelPropagation(nodes, edges, iterations = 12) {
  const label = new Map(nodes.map((n) => [n.id, n.id]));
  const neighbors = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    neighbors.get(e.source)?.push(e.target);
    neighbors.get(e.target)?.push(e.source);
  }
  for (let it = 0; it < iterations; it++) {
    const order = nodes.slice().sort(() => Math.random() - 0.5);
    for (const n of order) {
      const tally = new Map();
      for (const nb of neighbors.get(n.id) || []) {
        const l = label.get(nb);
        tally.set(l, (tally.get(l) || 0) + 1);
      }
      let best = null;
      let bestCount = 0;
      for (const [l, count] of tally) {
        if (count > bestCount || (count === bestCount && l < best)) {
          best = l;
          bestCount = count;
        }
      }
      if (best) label.set(n.id, best);
    }
  }
  const clusterIds = new Map();
  const clusters = new Map();
  for (const n of nodes) {
    const root = label.get(n.id);
    if (!clusters.has(root)) {
      clusters.set(root, clusterIds.size);
      clusterIds.set(root, clusterIds.size);
    }
    n.community = clusters.get(root);
  }
  return clusters.size;
}

export class ForceGraph {
  constructor(canvas, data, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hooks = hooks;
    this.dpr = window.devicePixelRatio || 1;

    this.rawNodes = (data.nodes || []).slice();
    this.rawEdges = (data.edges || []).slice();
    this.params = { repulsion: 1.0, linkDist: 72, showLimit: 200, labels: true };
    this.colorMode = "cluster";
    this.edgeFilter = new Set(["citation", "similarity"]);
    this.searchQuery = "";

    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.dragNode = null;
    this.hoverNode = null;
    this.selectedNode = null;
    this.raf = null;
    this.moved = false;

    this.prepare();
    this.bindEvents();
    this.resize();
    this.refit();
    this.loop();
  }

  prepare() {
    const sorted = this.rawNodes
      .slice()
      .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
    const included = sorted.slice(0, this.params.showLimit);
    const includedIds = new Set(included.map((n) => n.id));
    const radius = Math.max(90, Math.sqrt(included.length) * 26);
    this.nodes = included.map((n, idx) => {
      const angle = (idx / Math.max(1, included.length)) * Math.PI * 2;
      return {
        ...n,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        community: 0,
      };
    });
    this.edges = this.rawEdges.filter(
      (e) => includedIds.has(e.source) && includedIds.has(e.target)
    );
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.truncated = this.rawNodes.length > this.params.showLimit;
    this.minYear = Math.min(...this.nodes.map((n) => n.year || 2024));
    this.maxYear = Math.max(...this.nodes.map((n) => n.year || 2024));
    this.maxQuality = Math.max(...this.nodes.map((n) => n.quality_score || 0), 1);
    this.communityCount = labelPropagation(this.nodes, this.edges);
  }

  bindEvents() {
    const c = this.canvas;
    const pos = (e) => {
      const rect = c.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const toWorld = (p) => ({
      x: (p.x - this.panX) / this.scale,
      y: (p.y - this.panY) / this.scale,
    });

    c.addEventListener("mousedown", (e) => {
      this.moved = false;
      const w = toWorld(pos(e));
      const node = this.findNode(w);
      if (node) {
        this.dragNode = node;
        this.selectedNode = node;
        this.hooks.onSelect?.(node);
        c.classList.add("dragging");
      } else {
        this.drag = { startX: e.clientX, startY: e.clientY, panX: this.panX, panY: this.panY };
      }
    });

    window.addEventListener("mousemove", (e) => {
      const w = toWorld(pos(e));
      if (this.dragNode) {
        this.moved = true;
        this.dragNode.x = w.x;
        this.dragNode.y = w.y;
        this.dragNode.vx = 0;
        this.dragNode.vy = 0;
      } else if (this.drag) {
        this.moved = true;
        this.panX = this.drag.panX + (e.clientX - this.drag.startX);
        this.panY = this.drag.panY + (e.clientY - this.drag.startY);
      } else {
        this.hoverNode = this.findNode(w);
        c.style.cursor = this.hoverNode ? "pointer" : "grab";
      }
    });

    window.addEventListener("mouseup", () => {
      this.dragNode = null;
      this.drag = null;
      c.classList.remove("dragging");
    });

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const p = pos(e);
      this.scale = Math.min(4, Math.max(0.2, this.scale * factor));
      this.panX = p.x - (p.x - this.panX) * factor;
      this.panY = p.y - (p.y - this.panY) * factor;
    });

    c.addEventListener("click", (e) => {
      if (this.moved) return;
      const w = toWorld(pos(e));
      const node = this.findNode(w);
      if (!node && this.selectedNode) {
        this.selectedNode = null;
        this.hooks.onSelect?.(null);
      }
    });
  }

  findNode(w) {
    const r = 12 / this.scale;
    for (const n of this.nodes) {
      const dx = n.x - w.x;
      const dy = n.y - w.y;
      if (dx * dx + dy * dy < r * r) return n;
    }
    return null;
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this.w = rect.width;
    this.h = rect.height;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  nodeColor(n) {
    if (this.colorMode === "year") return yearColor(n.year || this.minYear, this.minYear, this.maxYear);
    if (this.colorMode === "quality") return qualityColor(n.quality_score || 0, this.maxQuality);
    return PALETTE[(n.community || 0) % PALETTE.length];
  }

  tick() {
    const nodes = this.nodes;
    const k = this.params.repulsion;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const min = 900 / this.scale;
        if (d2 < min) {
          const d = Math.sqrt(d2) || 0.01;
          const f = ((min - d2) / min) * 0.16 * k;
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f;
          b.vx += dx * f; b.vy += dy * f;
        }
      }
    }
    const link = this.params.linkDist;
    for (const e of this.edges) {
      const a = this.nodeMap.get(e.source);
      const b = this.nodeMap.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ((d - link) / d) * 0.012;
      a.vx += dx * f; a.vy += dy * f;
      b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const n of nodes) {
      if (n === this.dragNode) continue;
      n.vx += (0 - n.x) * 0.0006;
      n.vy += (0 - n.y) * 0.0006;
      n.vx *= 0.86;
      n.vy *= 0.86;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    const cx = 0, cy = 0;
    const world = { x: cx, y: cy };
    void world;

    const visibleEdges = this.edges.filter((e) => this.edgeFilter.has(e.type));
    for (const e of visibleEdges) {
      const a = this.nodeMap.get(e.source);
      const b = this.nodeMap.get(e.target);
      if (!a || !b) continue;
      ctx.strokeStyle = e.type === "similarity" ? "rgba(160,107,255,0.28)" : "rgba(53,230,255,0.32)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const n of this.nodes) {
      const r = Math.max(3, 3 + Math.sqrt(n.citation_count || 0) * 0.22);
      const color = this.nodeColor(n);
      const dim = this.searchQuery && !String(n.label || "").toLowerCase().includes(this.searchQuery.toLowerCase());
      ctx.globalAlpha = dim ? 0.18 : 0.92;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (n === this.selectedNode || n === this.hoverNode) {
        ctx.strokeStyle = "#eaffff";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      if (this.params.labels && (r > 5 || n === this.hoverNode || n === this.selectedNode)) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#dceaff";
        ctx.font = "10px ui-monospace, Consolas, monospace";
        ctx.fillText(String(n.label || n.id).slice(0, 22), n.x + r + 3, n.y + 3);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  loop = () => {
    this.tick();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  setColorMode(mode) { this.colorMode = mode; }
  setEdgeFilter(types) { this.edgeFilter = new Set(types); }
  setSearch(q) { this.searchQuery = q; }
  setParams(params) { Object.assign(this.params, params); this.prepare(); }
  refit() {
    this.scale = 1;
    this.panX = this.w / 2;
    this.panY = this.h / 2;
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}
