# AI4 Science 部署完成说明（2026-10-13）

## 一、结论

已按仓库 README / DEPLOYMENT.md 完成 Python 原生部署（本机未装 Docker，未走容器路径），
并用真实学术数据跑通「检索 → 分析 → 知识图谱 → TRL 评估 → 创新假设 → 报告」全流程。

部署过程中发现仓库本身有 7 处缺陷，不改则无法启动、或全流程恒为空结果，均已就地修复。

## 二、当前状态

- **部署目录**：`C:\Users\26733\Documents\ChatGPT\AI4 Science`（旧副本仍在 `C:\Users\26733\Documents\Codex\AI4S-Discovery`，勿混用）
- **服务**：API `http://127.0.0.1:8000`（`/docs`、`/health` 均 200），Web `http://127.0.0.1:8501`（200）
- **API 密钥**：见本地 `.env` 的 `API_KEY`（文档不保存明文密钥）
- **启动方式**：`start_api.bat` / `start_web.bat` / `start_cli.bat`
- **LLM 模式**：`OPENAI_API_KEY` 留空 → 自动降级为模拟(mock)模式，流程可跑通，但创新假设为占位内容
- **注意**：由我启动的服务在我的会话结束时会被回收，日常使用请自己运行上面的 bat 脚本

## 三、验证结果（真实数据）

提交任务「perovskite solar cell stability」（standard 深度）→ 42.7 秒完成：

| 环节 | 结果 |
| --- | --- |
| 文献检索 | 148 篇（arXiv 50、PubMed 50、Semantic Scholar 100） |
| 质量分析 | 148 篇，高质量 144 篇，平均被引 313，总被引 46318 |
| 关键词 | TF-IDF Top20（perovskite / solar cells / stability / efficiency …） |
| 知识图谱 | 144 节点、2023 条边、10 个社区 |
| TRL 评估 | Level 9，置信度 80% |
| 创新假设 | 1 个（mock 模式下走 JSON 解析降级分支；配 `OPENAI_API_KEY` 后为真实生成） |
| 报告 | Markdown 11.5 KB + HTML，样例见同目录《样例研究报告-钙钛矿太阳能电池稳定性.md》 |

其他验证：

- 全模块导入、API/Web 启动、`/health`、SQLite 初始化、admin 用户创建：通过
- `pytest tests`：29 passed（修复记录见第六节；最终打包目录复测 29 passed）
- 离线全流程（检索结果打桩为 6 篇）：通过，用于隔离验证分析/图谱/TRL 环节

## 四、7 处代码修复（当前仅在工作区，未 git commit）

`git diff --stat`：5 files changed, 142 insertions(+), 14 deletions(-)

| 文件 | 缺陷 | 修复 |
| --- | --- | --- |
| `src/core/config.py` | ① 用下划线命名做 pydantic 字段（`_default_encryption_key` 等），Pydantic v2 直接抛 `PydanticUserError`，应用无法导入；② `.env.example` 有大量未声明键，v2 默认 `extra='forbid'`，照 README 复制 `.env` 后必崩；③ 代码读取 14 个未声明字段（`LOG_LEVEL`、`LOG_PATH`、`PAPER_QUALITY_THRESHOLD`、`HYPOTHESIS_*`、`TRL_CONFIDENCE_THRESHOLD`、`GRAPH_MAX_NODES` …），`setup_logger()` 一调用就 `AttributeError` | 删除 2 个未使用字段；`extra="ignore"`；补齐 14 个字段 |
| `src/utils/encryption.py` | `self.backend` 在 `_derive_key()` 使用之后才赋值 → 加密管理器初始化即崩，密码哈希/AES 全不可用，admin 用户建不出来 | 调整赋值顺序 |
| `src/agents/coordinator_agent.py` | ① 调 `search(..., max_results=...)`，实际形参名是 `max_results_per_source` → `TypeError`，检索永远失败；② 对 `search()` 返回的每个 value 都做 `len()`，而 `total_papers` 是 int、`timestamp` 是 str → `object of type 'int' has no len()`，异常被吞后文献清零 | 改用正确形参；按 `sources` 统计并兼容旧结构 |
| `src/agents/search_agent.py` | ① `deduplicate_papers()` 只认 `{"papers": [...]}`，而 `search()` 返回带统计键的字典 → 结果被整体丢弃；② Semantic Scholar 遇 429 会 `sleep(60)`、最外层上限 95 次，未配 key 时任务可挂近 1.5 小时；③ aiohttp 默认用 Windows 系统证书库，系统库缺 arXiv/PubMed 所需根证书（如 Certainly Root R1）→ 所有学术源 `CERTIFICATE_VERIFY_FAILED`；④ `.env` 里声明的 `HTTP_PROXY/HTTPS_PROXY` 从未被使用 | 补齐去重解析；限流重试上限 3 次、退避 10s；显式改用 certifi 根证书；代理配置真正接入 aiohttp（默认空 = 直连，行为不变） |
| `requirements.txt` | — | 补记 `certifi` 为直接依赖 |

## 五、依赖说明（相对 requirements.txt）

- `torch==2.1.1` 在 Python 3.12 下无轮子，改装 `torch 2.14.1+cpu`（Windows + 无 NVIDIA 显卡，CPU 版足够）。
- 未安装：`torch-geometric`、`transformers`、`sentence-transformers`、`chromadb`、`faiss-cpu`、`spacy`、`selenium`、`weasyprint`、`bitsandbytes`、`neo4j`、`redis`、`biopython`、`scholarly`、`pymupdf`、`pdfplumber`、`PyPDF2`、`seaborn`、`plotly`、`pyecharts`、`nltk`、`jieba`、`arxiv`。
  理由：`faiss` / `sentence-transformers` 只被 `src/database/vector_store.py` 引用，而该模块在项目中没有任何导入点；其余属可选功能（本地大模型、PDF 解析、图表、图数据库）。
- 若要启用本地 LLM，需另装 `transformers` + `accelerate` 并下载 MiniCPM（README 第 5 步，可选）。

## 六、仓库自带测试的 8 项失败（已修复）

- `test_password_hashing`：原测试断言 SHA-256 的 64 字符长度，实际实现使用 bcrypt（60 字符）。已改为验证 bcrypt 前缀与实际校验结果。
- `TestDatabase` 共 7 项：原实现每次 `get_connection()` 都新建连接，`:memory:` 数据库在连接关闭后消失 → `no such table`。现已在内存数据库场景保留一条持久连接，文件数据库行为不变。

## 七、使用提示

- **检索请用英文关键词**：arXiv / PubMed 对中文查询基本无结果（实测「钙钛矿太阳能电池稳定性研究」0 篇，「perovskite solar cell stability」148 篇）。
- **Semantic Scholar** 未配 key 会限流，日志会提示跳过；在 `.env` 填 `SEMANTIC_SCHOLAR_API_KEY` 可提升额度。
- **本机环境**：DNS 由 Clash 接管（fake-IP），Clash 未运行时任何出网都会失败。
- **可选清理**：`.pip-cache/`（175 MB，pip 缓存）。
