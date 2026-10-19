// 使用指南

import { h } from "../ui.js";

export function render(view) {
  view.innerHTML = "";
  view.append(h("div", { class: "guide", html: guideHtml() }));
}

function guideHtml() {
  return `
    <div class="page-head">
      <div class="section-kicker">Manual · 使用指南</div>
      <h1>把科研问题交给多智能体</h1>
      <div class="lead">当前为在线只读演示：直接展示一份预置的完整研究结果。AI4 Science 面向「科研创新」场景，用 AI 与开源方法帮助理解资料、处理数据、组织知识。</div>
    </div>

    <div class="guide-grid">
      <div class="panel scan-sweep">
        <div class="panel-title">文献分析 <span class="bar"></span></div>
        <p class="dim">聚合 arXiv、PubMed、Semantic Scholar 等来源，去重、质量评分、关键词与趋势提取。</p>
      </div>
      <div class="panel scan-sweep">
        <div class="panel-title">科研知识管理 <span class="bar"></span></div>
        <p class="dim">构建引用 / 相似度知识图谱，社区检测、中心性分析与关键节点识别。</p>
      </div>
      <div class="panel scan-sweep">
        <div class="panel-title">数据处理 <span class="bar"></span></div>
        <p class="dim">自动完成统计、年度分布、高产作者、质量-年份散点等可视化分析。</p>
      </div>
      <div class="panel scan-sweep">
        <div class="panel-title">实验辅助 <span class="bar"></span></div>
        <p class="dim">TRL 技术成熟度评估、可行性、风险与资源估算，辅助研究路线决策。</p>
      </div>
    </div>

    <h2>演示怎么看</h2>
    <ol>
      <li>打开「结果工作台」，查看样例任务的核心指标与完整研究报告。</li>
      <li>继续向下滚动，查看知识图谱、数据分析、文献清单、TRL 评估与创新建议。</li>
      <li>点击「下载报告 MD」或「预览 HTML」可查看报告导出效果。</li>
      <li>在线版不提交真实任务；完整交互流程请在本地运行项目后体验。</li>
    </ol>

    <h2>参数说明</h2>
    <table>
      <thead><tr><th>参数</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td>研究领域</td><td>可多选，用于提升检索与跨域迁移推荐的针对性。</td></tr>
        <tr><td>分析深度</td><td>快速（基础检索）/ 标准（含图谱趋势）/ 全面（报告 + 假设 + TRL）。</td></tr>
        <tr><td>任务优先级</td><td>低 / 中 / 高 / 紧急，影响任务调度。</td></tr>
        <tr><td>专利分析</td><td>是否在检索中纳入专利数据。</td></tr>
        <tr><td>创新假设</td><td>基于研究空白生成创新假设与反事实推理。</td></tr>
        <tr><td>TRL 评估</td><td>评估技术成熟度（TRL 1-9）与可行性。</td></tr>
      </tbody>
    </table>

    <h2>键盘与交互</h2>
    <table>
      <thead><tr><th>操作</th><th>快捷键</th></tr></thead>
      <tbody>
        <tr><td>命令面板</td><td><span class="kbd">Ctrl</span> / <span class="kbd">⌘</span> + <span class="kbd">K</span></td></tr>
        <tr><td>切换视图</td><td><span class="kbd">1</span>–<span class="kbd">2</span></td></tr>
        <tr><td>关闭弹层 / 面板</td><td><span class="kbd">Esc</span></td></tr>
        <tr><td>图谱缩放 / 平移</td><td>滚轮 / 拖拽空白</td></tr>
        <tr><td>图谱拖拽节点</td><td>按住节点拖动</td></tr>
      </tbody>
    </table>

    <h2>REST API</h2>
    <p class="dim">公共接口需在请求头携带 <code>X-API-Key</code>（值见 <code>.env</code> 的 <code>API_KEY</code>）。同源界面使用 <code>/ui/api/*</code>，无需 Key。</p>
    <table>
      <thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td><code>POST</code></td><td><code>/api/v1/research/submit</code></td><td>提交研究任务</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/v1/research/status/{id}</code></td><td>查询任务状态</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/v1/research/result/{id}</code></td><td>获取任务结果</td></tr>
        <tr><td><code>DELETE</code></td><td><code>/api/v1/research/cancel/{id}</code></td><td>取消任务</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/v1/system/info</code></td><td>系统与设备信息</td></tr>
      </tbody>
    </table>

    <h2>常见问题</h2>
    <h3>没有 OpenAI API Key 能运行吗？</h3>
    <p class="dim">可以。系统会进入模拟模式，文献检索、图谱、TRL 仍可运行；LLM 假设生成会使用内置模板降级。</p>
    <h3>为什么文献数为 0？</h3>
    <p class="dim">通常是因为当前网络无法访问学术数据源（arXiv / PubMed / Semantic Scholar）。请检查网络或使用「演示」数据预览界面。</p>
    <h3>任务记录会保存吗？</h3>
    <p class="dim">任务记录保存在浏览器本地；服务端任务保存在内存中，服务重启后清空（与历史版本一致）。</p>
  `;
}
