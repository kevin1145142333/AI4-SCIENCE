// 指挥舱：研究任务提交

import { api } from "../api.js";
import { store, rememberTask } from "../store.js";
import { navigate } from "../router.js";
import { h, esc, toast } from "../ui.js";
import { playSound } from "../fx.js";

const DOMAINS = ["生物医药", "材料科学", "人工智能", "能源", "化学", "物理", "环境科学", "信息科学"];
const EXAMPLES = [
  "探索阿尔茨海默病免疫代谢靶点，需跨域文献支撑",
  "钙钛矿太阳能电池稳定性研究",
  "二维材料在芯片散热中的应用",
];

export function render(view) {
  view.innerHTML = "";

  view.append(
    h("div", { class: "page-head", html: `
      <div class="section-kicker">Cockpit · 任务指挥舱</div>
      <h1>发起一项研究任务</h1>
      <div class="lead">描述你的科研问题，多智能体将自动完成文献挖掘、知识图谱构建、TRL 评估与创新假设生成。</div>
    ` })
  );

  const query = h("textarea", {
    class: "textarea",
    placeholder: "例如：探索阿尔茨海默病免疫代谢靶点，需跨域文献支撑",
  });

  const selectedDomains = new Set();
  const chipRow = h("div", { class: "chip-row" });
  for (const d of DOMAINS) {
    const chip = h("button", { class: "chip", text: d, onclick: () => {
      if (selectedDomains.has(d)) selectedDomains.delete(d);
      else selectedDomains.add(d);
      chip.classList.toggle("on", selectedDomains.has(d));
    } });
    chipRow.append(chip);
  }

  const depth = h("select", { class: "select" }, [
    h("option", { value: "quick", text: "快速 · 基础检索与分析" }),
    h("option", { value: "standard", text: "标准 · 含图谱与趋势" }),
    h("option", { value: "comprehensive", text: "全面 · 完整报告 + 假设 + TRL", selected: "selected" }),
  ]);
  const priority = h("select", { class: "select" }, [
    h("option", { value: "low", text: "低" }),
    h("option", { value: "medium", text: "中", selected: "selected" }),
    h("option", { value: "high", text: "高" }),
    h("option", { value: "urgent", text: "紧急" }),
  ]);

  const makeSwitch = (label, checked) => {
    const input = h("input", { type: "checkbox" });
    input.checked = checked;
    return h("label", { class: "switch" }, [
      input,
      h("span", { class: "track" }),
      h("span", { text: label }),
    ]);
  };
  const swPatents = makeSwitch("包含专利分析", false);
  const swHypo = makeSwitch("生成创新假设", true);
  const swTrl = makeSwitch("TRL 评估", true);

  const core = h("div", { class: "core-ring" }, [
    h("div", { class: "status-txt", html: `<b>STANDBY</b><span>等待指令</span>` }),
  ]);

  const launch = h("button", {
    class: "btn btn-primary btn-lg btn-block",
    text: "启动研究任务",
    onclick: async () => {
      const q = query.value.trim();
      if (!q) {
        playSound("error");
        toast("请输入研究需求", "err");
        query.focus();
        return;
      }
      launch.disabled = true;
      core.querySelector(".status-txt").innerHTML = `<b>SUBMITTING</b><span>正在提交…</span>`;
      playSound("confirm");
      try {
        const res = await api.submit({
          query: q,
          domains: [...selectedDomains],
          depth: depth.value,
          priority: priority.value,
          include_patents: swPatents.querySelector("input").checked,
          generate_hypotheses: swHypo.querySelector("input").checked,
          trl_assessment: swTrl.querySelector("input").checked,
        });
        rememberTask({ id: res.task_id, query: q, createdAt: new Date().toISOString() });
        store.currentTaskId = res.task_id;
        toast("任务已提交，正在进入任务中心", "ok");
        navigate("#/tasks");
      } catch (err) {
        playSound("error");
        toast(err.message, "err");
        core.querySelector(".status-txt").innerHTML = `<b>STANDBY</b><span>等待指令</span>`;
      } finally {
        launch.disabled = false;
      }
    },
  });

  const exampleRow = h("div", { class: "examples chip-row" });
  exampleRow.append(h("span", { class: "faint", text: "试试：" }));
  for (const ex of EXAMPLES) {
    exampleRow.append(h("button", { class: "chip", text: ex, onclick: () => { query.value = ex; query.focus(); } }));
  }

  const left = h("div", { class: "panel cockpit-query" }, [
    h("h2", { class: "panel-title", html: "研究需求 <span class=\"bar\"></span>" }),
    query,
    exampleRow,
    h("div", { style: "margin-top:14px" }, [
      h("label", { class: "field-label", text: "研究领域（可选，多选）" }),
      chipRow,
    ]),
  ]);

  const right = h("div", { class: "panel cockpit-config" }, [
    h("h2", { class: "panel-title", html: "任务参数 <span class=\"bar\"></span>", style: "grid-column:1 / -1" }),
    h("div", {}, [h("label", { class: "field-label", text: "分析深度" }), depth]),
    h("div", {}, [h("label", { class: "field-label", text: "任务优先级" }), priority]),
    h("div", {}, [swPatents]),
    h("div", {}, [swHypo]),
    h("div", {}, [swTrl]),
  ]);

  const hero = h("div", { class: "cockpit-hero" }, [left, right]);
  const side = h("div", { class: "panel", style: "text-align:center" }, [
    h("h2", { class: "panel-title", html: "系统状态 <span class=\"bar\"></span>" }),
    core,
    h("div", { class: "dim", style: "font-size:12px", text: "后端以异步多智能体流水线执行：解析 → 检索 → 分析 → 图谱 → TRL → 假设 → 报告" }),
  ]);

  view.append(hero);
  view.append(h("div", { class: "section" }, [
    h("div", { class: "grid-2" }, [
      side,
      h("div", { class: "panel" }, [
        h("h2", { class: "panel-title", html: "执行命令 <span class=\"bar\"></span>" }),
        h("p", { class: "dim", text: "提交后可在任务中心实时查看进度，完成后进入结果工作台查看图谱、TRL、创新假设与完整报告。" }),
        launch,
      ]),
    ]),
  ]));
}
