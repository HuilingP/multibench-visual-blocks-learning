# MultiBench 可视化积木学习（MVP）

一个面向初学者的多模态学习实验沙盒：像搭积木一样拖拽出 pipeline，运行 toy 实验，并从 **Performance / Complexity / Robustness** 三个维度理解“为什么这样接能工作”。

## 项目亮点

- 可视化画布：拖拽节点、强类型端口连线、导出 Pipeline Spec
- 初学者模式：术语表、分步引导、积木透视（Trace）
- Toy Runner：端到端执行并返回三类指标
- 积木库流程：`draft -> pending_review -> approved -> published`
- 论文候选流：抓取论文 -> 候选提案 -> 人工审核 -> 生成草案积木版本

## 技术栈

- 前端：Next.js + React + TypeScript + React Flow
- 后端：FastAPI + SQLModel + Celery
- 存储：PostgreSQL（生产）/ SQLite（本地默认）
- 队列：Redis + Celery worker/beat

## 仓库结构

- `apps/web`：前端应用（画布、i18n、术语解释、Admin 页面）
- `apps/api`：后端应用（Runner、Registry、Review、Paper APIs）
- `specs/pipeline_spec.schema.json`：Pipeline Spec 强类型 Schema
- `docker-compose.yml`：本地一键运行依赖与服务

## 快速开始（Docker）

```bash
cp .env.example .env
docker compose up --build
```

访问地址：

- Web: `http://localhost:3000`
- API Docs: `http://localhost:8000/docs`
- Admin: `http://localhost:3000/admin`

## 本地开发（不使用 Docker）

### 1) 启动 API

```bash
cd apps/api
python3.11 -m venv .venv311
source .venv311/bin/activate
pip install -r requirements.txt

export DATABASE_URL="sqlite:///./multibench_mvp.db"
export ADMIN_KEY="dev-admin-key-change-me"
export WEB_ORIGINS="http://127.0.0.1:3000,http://localhost:3000"

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) 启动 Web

```bash
cd apps/web
npm install
NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8000" npm run dev
```

## 当前 MVP 能力

- Pipeline 画布：Dataset / Encoders / Fusion / Objective / Trainer / Evaluator
- 标准化数据接口：统一为 `batch.multimodal.v1`
- Explain Trace：展示每一步输入输出 shape 与核心逻辑
- Run 历史：保存 Spec、锁定版本、运行环境、指标、状态
- 论文候选审核：候选 JSON 审核通过后可一键 materialize 成 `BlockVersion(draft)`

## Pipeline Spec

- Schema 文件：`specs/pipeline_spec.schema.json`
- 目标：强类型端口、输入输出契约、版本锁定、可复现运行

## 安全与可复现（MVP）

- Spec 中包含 `lockedBlocks`（`blockId + version + digest`）用于锁定依赖
- 每次运行写入 `pipeline_runs`（spec、lock、环境、指标、状态）
- 真实容器沙箱与细粒度权限控制在后续里程碑增强（MVP 先保证端到端闭环）

## 审核流演示（Paper Candidate -> Block Draft）

1. 打开 `http://localhost:3000/admin`
2. 输入 `ADMIN_KEY`（在 `.env` 中）
3. 选择一个候选，生成或编辑提案 JSON
4. 保存后点击“通过”
5. 在“已通过”中执行“生成草案积木版本”
6. 系统会创建 `Block` / `BlockVersion(draft)` 进入后续发布流程

## CI（GitHub Actions）

- `web-ci`：`npm ci` + `npm run lint` + `npm run build`
- `api-ci`：Python 3.11 环境下执行基础导入与语法检查

## 路线图（下一步）

- 更形象的“积木透视”：动画式数据流 + 节点联动高亮
- 更完善的 Explain：每一步补充“为什么这个 shape 合理”
- 更接近生产的 Runner 隔离：资源限制、权限声明、审计日志
- 扩展多数据集与更多模态映射（在统一 batch 契约下演进）

