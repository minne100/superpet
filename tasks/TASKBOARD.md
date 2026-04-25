# 🎯 超级宠物在线版 — 项目任务看板

**项目经理：** 爪子（Claw）
**更新日期：** 2026-04-24 19:52
**依据文档：** `PRD_SuperPet_Online.md §3 功能需求清单` + `ARCHITECTURE_DRAFT_SuperPet_Online.md`

---

## 一、阶段概览

```
Phase 0: 调研与设计 ✅
├── T-001 市场调研 & 竞品分析     ✅
├── T-002 PRD v1.3                ✅
├── T-003 架构文档 v2.1           ✅
├── T-004 团队定义 & BMad集成     ✅
├── T-005 生图能力验证            ✅
├── T-006 卡牌引擎设计             ✅
└── T-007 卡牌JSON编写(120张)     ✅

Phase 1: 数值验证 ✅ (2026-04-24 19:37 全部完成)
├── F-01~F-09 引擎核心代码       ✅ (103单元测试通过)
├── F-10 Monte Carlo 模拟器       ✅
└── F-11 分析脚本                 ✅

Phase 2: 核心架构 ⚪
├── F-12~F-25 (基础软件架构 + 3D场景 + 网络层)

Phase 3: 完整可玩 ⚪
├── F-26~F-37 (比武交互 + 缩圈 + 结算 + 断线)

Phase 4: 打磨 ⚪
├── F-38~F-42 (杀戮局 + 多语言 + 音效)
```

---

## 二、完整任务清单（对应PRD F-01~F-42）

### Phase 0 — 调研与设计（✅ 全部完成）

| ID | PRD对应 | 任务 | 产出 | 状态 | 负责人 |
|---|---|---|---|---|---|
| T-001 | — | 市场调研 & 竞品分析 | `TASK-ANALYSIS-BRIEF.md` | ✅ **完成** | 小分 |
| T-002 | — | PRD编写 | `PRD_SuperPet_Online.md` v1.3 | ✅ **完成** | PM→老板拍板 |
| T-003 | — | 架构文档编写（含本地化策略） | `ARCHITECTURE_DRAFT_SuperPet_Online.md` v2.1 | ✅ **完成** | 阿架 |
| T-004 | — | 团队定义 & BMad集成 | `TEAM_DEFINITION.md` + `BMAD_INTEGRATION_PLAN.md` | ✅ **完成** | 爪子 |
| T-005 | — | 图像生成API能力验证 | `product_box_cover.png` | ✅ **完成** | 概念设计Agent |
| T-006 | — | 卡牌引擎设计（JSON+role/on_receive+Effect系统） | `card_engine_design_event3.md` | ✅ **完成** | 架构Agent |
| T-007 | F-04~F-07 | 卡牌JSON编写（120张） | `cards/neigong/opportunity/event/move/` | ✅ **完成** | 爪子 |

---

### Phase 1 — 数值验证（✅ 全部完成。2026-04-24 19:37）

| ID | PRD | 任务 | 优先级 | 状态 | 说明 |
|---|---|---|---|---|---|
| F-01 | F-01 | game-engine.js — 完整规则引擎 | P0 | ✅ **完成** | 7个核心类，103单元测试全部通过 |
| F-02 | F-02 | 骰子系统（确定性PRNG + 线性同余） | P0 | ✅ **完成** | 集成于GameEngine.applyAction('ROLL_DICE') |
| F-03 | F-03 | 32格棋盘 & 格子类型定义 | P0 | ✅ **完成** | Board.js，含advance()/getDistance()/isBattleCell() |
| F-04 | F-04 | 30种机遇卡引擎效果实现 | P0 | ✅ **完成** | CardInterpreter支持draw_card/roll_dice/add_gold等 |
| F-05 | F-05 | 30种事件卡引擎效果实现 | P0 | ✅ **完成** | CardInterpreter支持loop/calc/has_cards?/debuff等 |
| F-06 | F-06 | 30种招式卡 + 六边形范围运算 | P0 | ✅ **完成** | CombatSystem.isInRange() |
| F-07 | F-07 | 内功卡系统（30张，6种数值） | P0 | ✅ **完成** | Player.addCard()，含手牌管理 |
| F-08 | F-08 | 7种比武卡（天赋+商店）引擎效果 | P0 | ⚪ **Phase 2** | 比武卡对应商店系统 |
| F-09 | F-09 | 四层嵌套对战盘 + 缩圈逻辑 | P0 | ✅ **骨架完成** | CombatSystem.getApproachDamage() |
| F-10 | F-10 | Monte Carlo 模拟器（JS，复用game-engine.js） | P0 | ✅ **完成** | Simulator.js，runGames()支持多局聚合 |
| F-11 | F-11 | 模拟结果分析脚本 | P0 | ✅ **完成** | analyze.js，100局验证无崩溃 |

---

### Phase 2 — 核心架构

| ID | PRD | 任务 | 优先级 | 状态 | 负责人 | 预估 | 依赖 |
|---|---|---|---|---|---|---|---|
| F-12 | F-12 | 等候大厅（图标化房间列表，国旗/杀戮局/天赋标识） | P0 | ⚪ 待启动 | Developer Agent | 2天 | — |
| F-13 | F-13 | 创建房间（自动生成4位base36房间码+链接+二维码） | P0 | ⚪ 待启动 | Developer Agent | 1天 | F-12 |
| F-14 | F-14 | 公开/私有房权限控制 | P0 | ⚪ 待启动 | Developer Agent | 1天 | F-13 |
| F-15 | F-15 | 房间内聊天（语音+文字，开局前可用） | P0 | ⚪ 待启动 | Developer Agent | 2天 | F-12 |
| F-16 | F-16 | 开局配置（标准/杀戮局/天赋/投骰排序/再投） | P0 | ⚪ 待启动 | Developer Agent | 2天 | F-12 |
| F-17 | F-17 | 按顺序选宠物（点击后移动到面前） | P0 | ⚪ 待启动 | Developer Agent | 2天 | F-12, F-22 |
| F-18 | F-18 | WebRTC P2P 连接（4节点Mesh） | P0 | ⚪ 待启动 | Developer Agent | 3天 | F-19 |
| F-19 | F-19 | Rust 信令服务器（房间管理+ICE交换） | P0 | ⚪ 待启动 | Developer Agent | 2天 | — |
| F-20 | F-20 | 基础状态同步框架 | P0 | ⚪ 待启动 | Developer Agent | 2天 | F-18 |
| F-21 | F-21 | 3D建模：4只宠物棋子（猫/狗/兔/鹦鹉，带底座） | P0 | ⚪ 待启动 | 概念设计Agent | 2天 | — |
| F-22 | F-22 | 3D建模：桌面场景（棋盘+对战盘+卡牌+玻璃骰盅+计分器） | P0 | ⚪ 待启动 | 概念设计Agent | 2天 | — |
| F-23 | F-23 | 3D建模：4位兜帽人+方桌+椅子+昏暗房间环境 | P0 | ⚪ 待启动 | 概念设计Agent | 2天 | — |
| F-24 | F-24 | UI布局框架（信息栏/手牌浮空区/计分器/聊天） | P0 | ⚪ 待启动 | Developer Agent | 3天 | F-12, F-22 |
| F-25 | F-25 | 遮罩系统（比武时掀开露出对战盘） | P0 | ⚪ 待启动 | Developer Agent | 2天 | F-24 |

---

### Phase 3 — 完整可玩

| ID | PRD | 任务 | 优先级 | 状态 | 负责人 | 预估 | 依赖 |
|---|---|---|---|---|---|---|---|
| F-26 | F-26 | 比武模式完整交互（选位→出招→移动→结算） | P1 | ⚪ 待启动 | Developer Agent | 5天 | F-01,F-18,F-24,F-25 |
| F-27 | F-27 | 比武卡使用（购买/闪避/反弹/位置卡提示） | P1 | ⚪ 待启动 | Developer Agent | 3天 | F-08, F-26 |
| F-28 | F-28 | 缩圈3D动画 | P1 | ⚪ 待启动 | Developer Agent | 2天 | F-09, F-26 |
| F-29 | F-29 | 信息栏 & 历史日志 | P1 | ⚪ 待启动 | Developer Agent | 1天 | F-24 |
| F-30 | F-30 | 计分器（滚轮拨盘样式） | P1 | ⚪ 待启动 | Developer Agent | 2天 | F-24 |
| F-31 | F-31 | 终局结果页（表格统计+实体版跳转按钮） | P1 | ⚪ 待启动 | Developer Agent | 1天 | F-26 |
| F-32 | F-32 | 断线检测+30秒等待+AI托管 | P1 | ⚪ 待启动 | Developer Agent | 3天 | F-01, F-19 |
| F-33 | F-33 | 在线统计（主页实时+后台） | P1 | ⚪ 待启动 | Developer Agent | 2天 | F-12, F-19 |
| F-34 | F-34 | 物理屏蔽罩3D建模 | P1 | ⚪ 待启动 | 概念设计Agent | 2天 | F-23 |
| F-35 | F-35 | 天赋系统 | P1 | ⚪ 待启动 | Developer Agent | 1天 | F-01, F-17 |
| F-36 | F-36 | 浮空选牌交互（唯一非拟真交互） | P1 | ⚪ 待启动 | Developer Agent | 2天 | F-24 |
| F-37 | F-37 | 摄像机系统（固定俯视+滚轮缩放+手机旋转） | P1 | ⚪ 待启动 | Developer Agent | 2天 | F-24 |

---

### Phase 4 — 打磨

| ID | PRD | 任务 | 优先级 | 状态 | 负责人 | 预估 | 依赖 |
|---|---|---|---|---|---|---|---|
| F-38 | F-38 | 杀戮局模式 | P2 | ⚪ 待启动 | Developer Agent | 1天 | F-01 |
| F-39 | F-39 | 多语言支持（中/英） | P2 | ⚪ 待启动 | 文案Agent | 2天 | F-24 |
| F-40 | F-40 | 断线重连 | P2 | ⚪ 待启动 | Developer Agent | 2天 | F-32 |
| F-41 | F-41 | 音效系统 | P2 | ⚪ 待启动 | Developer Agent | 3天 | F-24 |
| F-42 | F-42 | 背景音乐切换 | P2 | ⚪ 待启动 | Developer Agent | 2天 | F-41 |

---

## 三、Dependencies 矩阵

```
卡牌JSON T-007(✅) → 卡牌引擎设计 T-006(✅)
                        ↓
F-01~F-09 game-engine.js + 引擎层 (✅ Phase 1 完成)
        ↓
F-10 Monte Carlo ← F-01~F-09 (✅)
        ↓
F-11 分析脚本 ← F-10 (✅)
        ↓
← Phase 1 结束: 引擎核心验证通过 →
        ↓
Phase 2 和 Phase 3 可部分并行:
    F-19 信令服务器(独立)
    F-21~F-23 3D建模(独立)
    F-12~F-14 等候大厅(独立)
    齐汇于 F-24 UI布局框架
        ↓
F-26 比武交互 ← F-01 + F-18 + F-24 + F-25
        ↓
F-31 终局/F-33 在线统计/F-32 断线
```

---

## 四、管理规则

1. **文件权限**：所有项目文件设为 `666`
2. **更新规范**：修改任何文件后，同步更新本看板 + FILE_INDEX.md + 对应清单
3. **任务流转**：⚪待启动 → 🔵进行中 → ✅完成
4. **阶段推进**：Phase 0 ✅ → Phase 1 ✅ → Phase 2 进行中 → Phase 3 → Phase 4
