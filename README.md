# MultiBench 可视化积木学习（MVP）

目标：用“可视化积木”拖拽搭建多模态学习 pipeline，并运行 toy 实验返回 **Performance / Complexity / Robustness**，同时具备 **Block Registry（版本/审核/发布）** 与 **Paper Watcher（候选积木进入待审队列）** 的最小骨架。

## 快速开始（Docker Compose）

1) 准备环境变量

```bash
cp .env.example .env
```

2) 一键启动

```bash
docker compose up --build
```

3) 访问

- Web: `http://localhost:3000`
- API: `http://localhost:8000/docs`
- Admin（论文候选审核）：`http://localhost:3000/admin`

## 本地开发（不使用 Docker）

当你本机没有 Docker 时，也可以分别启动：

```bash
# API
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://multibench:multibench@localhost:5432/multibench"  # 或改为你自己的
export ADMIN_KEY="dev-admin-key-change-me"
export WEB_ORIGIN="http://localhost:3000"
uvicorn app.main:app --reload --port 8000
```

```bash
# Web
cd apps/web
npm install
NEXT_PUBLIC_API_BASE_URL="http://localhost:8000" npm run dev
```

## 目录结构

- `apps/web`: Next.js + React Flow 画布（导出 pipeline spec、发起 run、展示历史）
- `apps/api`: FastAPI（Spec 校验、toy runner、Block Registry、Review、Paper Watcher 骨架）

## Pipeline Spec Schema

- JSON Schema: `specs/pipeline_spec.schema.json`

## MVP Toy Runner

后端内置一个可复现的 toy “audio+vision”二模态数据集生成器，支持：

- 训练：线性 encoder + fusion + 线性分类器
- 指标：
  - Performance：Accuracy（可扩展）
  - Complexity：参数量 + 训练耗时（可扩展）
  - Robustness：输入噪声扰动下 Accuracy 下降（可扩展）

## 安全与可复现（MVP 形态）

- Spec 必须包含 `lockedBlocks`（blockId+version+digest）以锁定版本
- 每次运行写入 `pipeline_runs`，记录：spec、解析后的锁文件、运行环境、指标与状态
- 真实的隔离执行（容器沙箱/资源限制/权限声明）在后续里程碑中补齐；MVP 先以“受控 toy runner”闭环演示

## 演示：论文候选 → 审核 → 生成草案积木（MVP）

1) 打开 Admin 页：`/admin`，输入 `.env` 中的 `ADMIN_KEY`
2) 在“待审”列表中选一个候选
3) 点击“生成 Stub 提案”（MVP 用于无外部 LLM 的端到端演示），或直接在右侧粘贴/编辑候选 JSON
4) 点击“保存提案 JSON”
5) 点击“通过”
6) 切到“已通过”，点击“生成草案积木版本”
7) 生成的 `block_versions` 会以 `draft` 进入积木库后续审核/发布流（见 API：`/reviews/*`）

