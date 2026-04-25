# BMad Method × OpenClaw：超级宠物 AI 开发团队

## 核心理念

学习 BMad Method 的**角色体系和工作流**，但用 OpenClaw 的 `sessions_spawn` + `subagents` 来实现多 Agent 协作。

## 团队角色（BMad 适配）

| BMad Agent | 我们的角色 | OpenClaw 实现方式 | 负责工作 |
|---|---|---|---|
| **Analyst (Mary)** | 调研 Agent | `web_search` + `web_fetch` 工具 | 市场调研、竞品分析、桌游工厂调研 |
| **PM (John)** | 你（老板） | 直接你指挥 | PRD、Epics & Stories、优先级 |
| **Architect (Winston)** | 架构 Agent | 我作为 Orchestrator | 技术方案、ADRs、模块划分 |
| **Developer (Amelia)** | 开发 Agent | `sessions_spawn` + coding-agent | 数值模拟器、网页版App |
| **UX Designer (Sally)** | 设计 Agent | Gemini/生图 | 宠物立绘、卡牌设计、UI |
| **Technical Writer (Paige)** | 文案 Agent | 当前模型 | 规则书、众筹文案、小红书 |
| **QA** | 测试 Agent | spawn 独立 session | 规则逻辑验证、数值平衡 |

## 工作流 Pipeline

```
Phase 1: 分析
├── 调研 Agent → 桌游市场/工厂/竞品报告
└── 老板 + 我 → 产品定位确认

Phase 2: 规划（先做这个！）
├── 我 → 编写 TASK 清单（Epics + Stories）
└── 任务 ID: TASK-001 到 TASK-XXX

Phase 3: 实施（并行可串行）
├── TASK-001: 数值模拟器（第一优先级）
│   └── spawn 开发 Agent → 写 Python 跑 Monte Carlo
├── TASK-002: 概念设计
│   └── spawn 设计 Agent（需 API key）
├── TASK-003: 卡牌模板
│   └── spawn 设计 Agent
└── TASK-004: 网页版 App
    └── spawn 开发 Agent（模拟器验证后启动）

Phase 4: 发布
├── 规则书定稿
├── 众筹文案
└── 小红书预热
```

## 任务管理

遵循 agent-team-orchestration 的 task-lifecycle：
```
Inbox → Assigned → In Progress → Review → Done | Failed
```

任务记录存在 `/home/lu/superpet/tasks/TASK-XXX.json`
