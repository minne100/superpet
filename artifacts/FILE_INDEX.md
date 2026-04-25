# 📁 超级宠物在线版 — 项目文件清单

**最后更新：** 2026-04-24 19:52
**目录：** `/home/lu/superpet/`
**文件总数：** 147（含120张卡牌JSON + 18个engine/test/sim开发文件）

---

## 根目录

| 文件 | 大小 | 说明 |
|---|---|---|
| `桌游规则书与产品设计指南.md` | 25KB | 原始游戏规则（老板撰写） |

---

## `artifacts/` — 核心设计产出

| 文件 | 大小 | 说明 | 角色 |
|---|---|---|---|
| `PRD_SuperPet_Online.md` | ~15KB | 产品需求文档 v1.3（最终版） | PM→老板拍板 |
| `ARCHITECTURE_DRAFT_SuperPet_Online.md` | ~20KB | 架构设计 v2.1（含本地化策略） | 阿架 |
| `card_engine_design_event3.md` | ~8KB | 卡牌引擎规格（JSON驱动+role/on_receive+Effect系统） | 阿架 |
| `product_box_cover.png` | — | 包装盒概念图 | 生图验证 |

---

## `cards/` — 卡牌JSON（共120张）

| 类型 | 数量 | 编号格式 | JSON字段 | 进度 |
|---|---|---|---|---|
| `neigong_*.json` | 30 | 001~030 | buff_next_cultivation, stat, value | ✅ **100%** |
| `opportunity_*.json` | 30 | 001~030 | 含 roll_dice/debuff/draw_card/has_cards? 等 | ✅ **100%** |
| `event_*.json` | 30 | 001~030 | 多人交互、广播、循环 | ✅ **100%** |
| `move_*.json` | 30 | 001~030 | 六边形坐标偏移数组 | ✅ **100%** |

**JSON规范：**
- 必有字段：`cardId`, `type`, `description`, `steps`
- 无运行时文本（message/name/title 等）
- `description` 仅开发调试用，UI层查本地化表显示

---

## `tasks/` — 任务管理

| 文件 | 说明 |
|---|---|
| `TASKBOARD.md` | 项目看板（Phase划分、Dependencies、全部25+任务状态） |
| `CARD_JSON_CHECKLIST.md` | 卡牌JSON编写清单（逐张标记） |
| `TASK-ANALYSIS-BRIEF.md` | 分析师初版简报（小分产出） |

---

## `team/` — 团队定义

| 文件 | 说明 |
|---|---|
| `TEAM_DEFINITION.md` | BMad 7角色定义 |
| `BMAD_INTEGRATION_PLAN.md` | BMad与OpenClaw整合方案 |

---

## `app/` — 游戏应用

| 文件 | 大小 | 说明 |
|---|---|---|
| `DEV_GUIDE.md` | 21KB | 开发指南（小开撰写：架构/类定义/测试/编码规范/开发顺序） |
| `package.json` | 0.5KB | node --test 配置 |

### `app/engine/` — 引擎层核心

| 文件 | 大小 | 说明 |
|---|---|---|
| `game-engine.js` | 12KB | 引擎核心，applyAction()唯一入口，7种操作类型 |
| `player.js` | 6KB | 玩家类：属性/手牌/比武状态 |
| `board.js` | 4KB | 32格环形棋盘：advance/getDistance/isBattleCell |
| `turn-manager.js` | 3KB | 回合管理：轮转/跳过/轮次自动递增 |
| `effect-manager.js` | 4KB | 效果注册表：skip_turn/dice_x2等效果管理 |
| `card-interpreter.js` | 10KB | 卡牌JSON解释器：action分发/loop/role解析 |
| `load-cards.js` | 2KB | 卡牌JSON加载器+洗牌+缓存 |
| `combat-system.js` | 2KB | 比武系统：伤害/命中范围/缩圈（Phase 1骨架） |

### `app/test/` — 单元测试

| 文件 | 用例数 | 说明 |
|---|---|---|
| `player.test.js` | 17 | Player初始化/手牌/属性/比武/toJSON |
| `board.test.js` | 19 | Board初始化/前进/距离/比武格判断/格子查询 |
| `effect-manager.test.js` | 16 | 添加/消耗/轮次递减/清除/序列化 |
| `turn-manager.test.js` | 10 | 初始化/回合推进/跳过/轮次/阶段/toJSON |
| `card-interpreter.test.js` | 15 | 机遇卡/事件卡/120张加载/连续执行 |
| `game-engine.test.js` | 13 | 初始化/applyAction/确定性/终局/查询 |
| `consistency.test.js` | 3 | P2P状态一致性：同seed全确定性验证 |
| `combat-system.test.js` | 6 | 受击判定/伤害计算/命中范围/缩圈 |
| `simulator.test.js` | 6 | 单局模拟/多局聚合/确定性/报告 |

### `app/sim/` — 数值模拟器

| 文件 | 大小 | 说明 |
|---|---|---|
| `simulator.js` | 9KB | Monte Carlo模拟器：runSingleGame/runGames/printReport |
| `analyze.js` | 2KB | 分析脚本：1000局级命令行验证 |

### `sim/` — 模拟产出

| 文件 | 大小 | 说明 |
|---|---|---|
| `report_phase1_v2.txt` | 2.0KB | Phase 1 数值验证报告 v2 — 正确触发终局+格子效果 |

---

## 文件权限

所有文件设为 `666`（所有者/组/其他人可读写），方便老板Windows端直接编辑。

---

## 操作原语清单（完整版）

| 原语 | 用途 | 是否需要网络 |
|---|---|---|
| `notify_all` | 通知所有玩家（UI层显示） | ❽ 仅UI |
| `roll_dice` | 玩家投骰子 | ✅ 等待玩家输入 |
| `wait_dice` | 等待别人投骰结果 | ✅ 等待广播消息 |
| `calc` | 表达式计算 | ❽ 内部 |
| `has_cards?` | 检查手牌 | ❽ 内部 |
| `reveal_and_pick` | 展示对方手牌+选择 | ✅ 单播+等待 |
| `wait_pick` | 等待被选 | ✅ 等待广播消息 |
| `transfer_card` | 转移卡牌 | ❽ 内部 |
| `player_choice` | 二选一 | ✅ 等待玩家输入 |
| `negate_damage` | 抵消伤害 | ❽ 内部 |
| `discard_card` | 弃牌 | ❽ 内部 |
| `add_gold` | 加金币 | ❽ 内部 |
| `remove_gold` | 扣金币（带floor） | ❽ 内部 |
| `draw_card` | 抽卡 | ❽ 内部 |
| `choose_discard` | 选牌丢弃 | ✅ 等待玩家输入 |
| `random_discard` | 随机弃牌 | ❽ 内部 |
| `perm_buff` | 永久属性增强 | ❽ 内部 |
| `debuff` | 挂状态效果 | ❽ 内部 |
| `advance` | 前进步数 | ❽ 内部 |
| `immediate_cultivate` | 立即修炼 | ❽ 内部 |
| `buff_next_cultivation` | 内功卡：下次修炼增强 | ❽ 内部 |
| `broadcast` | 广播消息（仅数据） | ✅ 网络发送 |
| `if` | 条件分支 | ❽ 内部 |
| `goto` | 跳转step | ❽ 内部 |
| `end` | 结束卡牌流程 | ❽ 内部 |
| `loop` | 遍历玩家列表 | ❽ 内部 |
| `transfer_gold` | 金币转移（带 ceil_on_source 上限） | ❽ 内部 |
| `return_to_deck` | 卡牌放回牌堆（插入位置由种子计算） | ❽ 内部 |
| `pick_card` | 玩家选牌 | ✅ 等待玩家输入 |
| `pick_and_return` | 玩家选牌放回牌堆 | ✅ 等待玩家输入 |
