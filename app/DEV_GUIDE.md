# 《超级宠物》开发指南

**作者：** 小开（资深JS开发工程师）
**版本：** v1.0
**日期：** 2026-04-24
**基于：** PRD v1.3 + 架构文档 v2.1 + 卡牌引擎设计 v3

---

## 1. 架构全景

```
┌─────────────────────────────────────────────────┐
│                    UI 层                         │
│  Three.js 场景 / 浮空选牌 / 信息栏 / 计分器     │
│          ⬆ 调用               ⬆ 本地化          │
│          └──────←──────┬──────→── locales/*.json │
├─────────────────────────────────────────────────┤
│                    引擎层                        │
│  GameEngine  ←→  CardInterpreter                │
│      ↕              ↕                            │
│  TurnManager    EffectManager                    │
│      ↕                                           │
│  Board / Player / CombatSystem                   │
│          ⬆ applyAction(action)                   │
├─────────────────────────────────────────────────┤
│                   网络层                          │
│  NetworkManager (WebRTC)                         │
│      ↕        ↕                                  │
│  SignalingClient → Rust 信令服务器                │
└─────────────────────────────────────────────────┘

关键原则:
1. 引擎层纯计算 —— 无UI、无网络调用、无I/O
2. 网络层只传JSON —— 无业务逻辑
3. UI层查本地化表 —— 引擎不输出文本
4. applyAction() 是引擎唯一入口
```

---

## 2. 文件结构

```
/home/lu/superpet/app/
├── engine/
│   ├── game-engine.js      // GameEngine 类 — 游戏大脑
│   ├── card-interpreter.js // CardInterpreter 类 — 卡牌JSON解释器
│   ├── turn-manager.js     // TurnManager 类 — 回合控制器
│   ├── effect-manager.js   // EffectManager 类 — Effect Registry
│   ├── combat.js           // CombatSystem 类 — 比武系统
│   ├── board.js            // Board 类 — 32格棋盘
│   └── player.js           // Player 类 — 玩家状态
├── network/
│   ├── network-manager.js  // NetworkManager 类 — WebRTC封装
│   └── signaling-client.js // SignalingClient 类 — 信令连接
├── ui/
│   ├── three-scene.js      // Three.js 场景管理
│   ├── dice-shaker.js      // 物理骰盅
│   ├── card-display.js     // 浮空选牌交互
│   ├── info-panel.js       // 信息栏
│   ├── scoreboard.js       // 计分器（滚轮拨盘样式）
│   └── camera.js           // 摄像机控制
├── sim/
│   └── simulator.js        // Monte Carlo 模拟器
├── locales/
│   ├── zh-CN.json          // 中文本地化文件（默认）
│   └── en-US.json          // 英文本地化文件
├── server/                 // Rust 信令服务器（单独项目）
│   └── ...
└── test/                   // 测试文件
    ├── card-interpreter.test.js
    ├── game-engine.test.js
    ├── combat.test.js
    ├── effect-manager.test.js
    └── consistency.test.js
```

---

## 3. 核心类定义

### 3.1 Player — 玩家状态

```javascript
/**
 * @class Player
 * @description 单个玩家的全部状态。每个GameEngine实例管理4个Player实例。
 */
class Player {
  // ===== 属性 =====
  id            // string — 玩家唯一标识
  name          // string — 宠物名称（猫/狗/兔/鹦鹉）
  talent        // string|null — 天赋（如开启）
  gold          // number — 当前金币数（初始5）
  attack        // number — 攻击力（初始1）
  defense       // number — 防御力（初始1）
  
  position      // number — 棋盘上的格子索引（0-31）
  inCombat      // boolean — 是否在比武中
  combatPos     // {x, y, dir}|null — 比武对战盘上的位置和方向
  
  hand          // { move: Card[], neigong: Card[] } — 手牌
  buffs         // Effect[] — 挂载的效果/状态
  
  alive         // boolean — 是否健在（杀戮局可能被淘汰）
  skipNextTurn  // boolean — 是否下一轮轮空
}
```

### 3.2 Board — 32格棋盘

```javascript
/**
 * @class Board
 * @description 32格跑道地图。每格有固定类型，按索引访问。
 */
class Board {
  // ===== 属性 =====
  cells         // Cell[32] — 32格数组
  
  // ===== 方法 =====
  getCell(index)                // 获取指定格
  getType(index)                // 获取格子类型 'cultivate'|'opportunity'|...
  advance(fromIndex, steps)     // 从fromIndex前进steps步，循环绕圈
  getDistance(a, b)             // 两格之间的最短距离（绕圈计算）
}

/**
 * @typedef {Object} Cell
 * @property {number} index     — 格子编号 (0-31)
 * @property {string} type      — 格子类型
 * @property {string} cellName  — 格子名称（本地化用）
 */
```

### 3.3 TurnManager — 回合控制器

```javascript
/**
 * @class TurnManager
 * @description 控制跑圈阶段的回合顺序和轮次管理。
 */
class TurnManager {
  // ===== 属性 =====
  order         // string[] — 玩家ID列表（按跑圈顺序排列）
  currentIndex  // number — 当前玩家在order中的索引
  round         // number — 当前大轮数（所有人完成一次算一轮）
  phase         // string — 当前阶段名
  
  // ===== 方法 =====
  init(order)                       // 初始设置跑圈顺序
  nextTurn()                        // 轮到下一位玩家
  getCurrentPlayer()                // 获取当前玩家ID
  isRoundComplete()                 // 是否所有玩家都行动完了
  advanceRound()                    // 进入下一大轮
  skipPlayer(playerId)              // 标记玩家本轮跳过
  setPhase(name)                    // 切换阶段（run / combat / settlement）
}

/**
 * @description 回合流程：
 * 1. nextTurn() → 确定当前玩家
 * 2. 玩家投骰子 → 引擎计算前进格数和触发效果
 * 3. 处理触发（卡牌/修炼/抽卡）
 * 4. 检查 roundComplete → 是则 advanceRound
 * 5. 检查 combatTrigger → 进入比武模式
 */
```

### 3.4 EffectManager — Effect Registry

```javascript
/**
 * @class EffectManager
 * @description 管理玩家身上的状态效果（debuff/buff）。
 * 不是回调、不是遍历——游戏引擎的动作函数主动查询这里。
 */
class EffectManager {
  // ===== 属性 =====
  registry      // Map<playerId, Effect[]>
  
  // ===== 方法 =====
  add(playerId, effectName, rounds)       // 挂载效果
  get(playerId, effectName)               // 是否有某效果 → boolean
  use(playerId, effectName)               // 消耗某效果一次（立即清除）
  tick(playerId, effectName)              // 效果轮次-1
  tickAll()                               // 所有玩家所有效果轮次-1
  clear(playerId, effectName)             // 主动移除效果
  clearAll(playerId)                      // 清除玩家所有效果
  list(playerId)                          // 列出玩家所有活跃效果
}

/**
 * @typedef {Object} Effect
 * @property {string} source    — 来源卡牌ID（如"opportunity_008"）
 * @property {string} name      — 效果名称（如"skip_turn", "dice_x2"）
 * @property {number} rounds    — 剩余轮次
 */
```

### 3.5 CardInterpreter — 卡牌JSON解释器

```javascript
/**
 * @class CardInterpreter
 * @description 解释卡牌JSON中的steps数组，逐条执行。
 * 每步根据role决定当前节点行为：
 * - "all" → 引擎内部直接执行
 * - 分角色 → 需要玩家输入或等待广播
 */
class CardInterpreter {
  // ===== 属性 =====
  engine        // GameEngine — 引用宿主引擎
  
  // ===== 核心方法 =====
  interpret(cardJson, context)      
  // 解析steps数组 → 依次执行
  // 返回 { complete: boolean, waitForInput: {...}|null, broadcasts: [...] }
  
  executeStep(step, context)        
  // 执行单步
  
  resolveRole(step, context)       
  // 解析step.role → 确定当前节点身份（actor/target/others）
  // 返回：哪个玩家做什么
  
  handleCallback(step, message)    
  // 处理on_receive回调 → 匹配message_type + filter
}

/**
 * @description 解释器状态机：
 * 执行step → 检查role
 *   ├── role: "all" → 执行 → 继续下一步
 *   ├── role 含actor → 判断当前节点是否actor
 *   │   ├── 是 → 等待玩家输入 → 广播结果
 *   │   └── 否 → 等待广播消息 → 匹配on_receive → 执行 → 继续
 *   └── role: 仅"wait" → 挂起，等广播
 */
```

### 3.6 CombatSystem — 比武系统

```javascript
/**
 * @class CombatSystem
 * @description 管理比武阶段的所有逻辑。
 * 核心：六边形坐标运算 + 缩圈 + 比武卡
 */
class CombatSystem {
  // ===== 属性 =====
  arena         // Arena — 四层对战盘
  positions     // Map<playerId, {x, y, direction}>
  shelf         // BattleCard[] — 商店卡池
  round         // number — 当前比武轮次（每5轮缩圈一次）
  shieldOpen    // boolean — 屏蔽罩状态
  
  // ===== 方法 =====
  startCombat(participants)             // 初始化比武
  setInitPosition(playerId, x, y, dir)  // 设置初始位置和方向
  getMoveOrder()                        // 出手顺序（先手卡优先）
  calcHit(attackerId, moveCard, dir, targetId) // 六边形命中判定
  applyHit(attackerId, targetId, damageBuffed) // 应用伤害结果
  useBattleCard(playerId, cardId, targetId?)   // 使用比武卡
  advanceRound()                        // 进入下一比武轮→检查缩圈
  shrinkArena()                         // 缩圈
  isCombatOver()                        // 是否只剩下1人
  endCombat()                           // 结算比武
}

/**
 * @description 比武流程：
 * 1. startCombat → 所有玩家秘密选位
 * 2. getMoveOrder → 确定出手顺序
 * 3. 轮到玩家 → 可选购买比武卡 + 选招式 + 确认出招
 * 4. calcHit → 判定命中 → applyHit
 * 5. 被击中者→可用闪避/反弹卡（系统询问）
 * 6. 出招结束 → 可选移动
 * 7. 所有人完成 → advanceRound → 检查缩圈
 * 8. 直到仅剩1人 → endCombat
 */
```

### 3.7 GameEngine — 游戏引擎总控

```javascript
/**
 * @class GameEngine
 * @description 整个游戏的大脑。管理全部子系统，是engine/目录的对外接口。
 * 设计原则：applyAction(action) 是唯一公共入口。
 * action的来源可以是：玩家操作、网络广播、AI决策。
 */
class GameEngine {
  // ===== 属性 =====
  state         // GameState — 完整游戏状态
  players       // Player[4] — 玩家列表
  board         // Board — 棋盘
  turnManager   // TurnManager — 回合控制
  effectManager // EffectManager — 效果注册表
  cardInterpreter // CardInterpreter — 卡牌解释器
  combat        // CombatSystem|null — 比武系统
  decks         // { move, neigong, opportunity, event, battle } — 牌堆
  config        // GameConfig — 游戏配置（标准/杀戮局、天赋等）
  seed          // number — 随机种子（开局锁定）
  rng           // 确定性PRNG实例
  history       // Action[] — 全操作历史记录（调试/可回溯）
  
  // ===== 公共接口 =====
  init(config)                          // 初始化游戏
  applyAction(action)                   // 唯一入口：处理操作
  getValidActions(playerId)             // 获取玩家当前可用的操作（AI用）
  isGameOver()                          // 是否终局
  getResult()                           // 终局结果（排名）
  getState()                            // 完整状态快照（调试/验证用）
  
  // ===== 内部方法 =====
  processDiceRoll(playerId, value)      // 处理骰子结果
  processLanding(playerId, cellIndex)   // 处理落地效果
  processCardTrigger(cardId, context)   // 触发卡牌
  checkGameOver()                       // 检查终局条件
}

/**
 * @typedef {Object} Action
 * @property {string} type     — 动作类型
 * @property {string} playerId — 执行玩家
 * @property {Object} data     — 动作数据
 * @property {number} seq      — 序列号（单调递增）
 */

/**
 * @description applyAction 流程：
 * 1. 校验action合法性（玩家是否正确、状态是否允许）
 * 2. 执行action，修改state
 * 3. 检查是否触发卡牌/事件
 * 4. 检查是否终局
 * 5. 返回 { stateChanges, broadcasts, waitForInput }
 *    - stateChanges: 本次动作引起的状态变更（增量）
 *    - broadcasts: 需要广播给其他节点的消息列表
 *    - waitForInput: 是否需要等待玩家进一步输入
 */
```

---

## 4. 数据流

### 4.1 正常回合流程

```
1. 玩家点击"投骰子"
    → UI层: { type: "ROLL_DICE" }
    → NetworkManager: 广播 { type: "ROLL_DICE", playerId: "A", seq: 42 }
    → 所有节点 GameEngine.applyAction(action)
       → 引擎内部: processDiceRoll("A", value)
          → 计算前进格数（检查debuff: dice_x2/half）
          → 更新棋盘位置
          → 检查落地格子类型
          → 触发格子效果（修炼/抽卡/机遇/事件/比武）
    → 引擎返回 broadcasts（如有卡牌效果需要互动）
    → 重复以上过程
```

### 4.2 卡牌效果流程（以事件#3为例）

```
触发: 玩家踩到事件格
  → processCardTrigger("event_003", { trigger: "A" })
  → CardInterpreter.interpret(event_003.json, context)
     → Step 1: notify_all (role: all)
        → 引擎直接处理: UI层查询本地化表显示"投骰子最大的玩家从最小的玩家处夺取1张招式卡"
     → Step 2: dice_loop (分角色)
        → 每个玩家等待自己投骰或等广播
        → 所有骰子结果收集完毕 → 进入下一步
     → Step 3: calc_winner (role: all)
        → 各节点独立计算 → 确定性保证一致
     → Step 4: check_loser_hand (role: all)
        → 失败（无招式卡）→ goto end
     → Step 5: winner_select (分角色)
        → actor(胜者)弹出选牌 → 广播选择
        → others/target收到 → 继续
     → Step 6: transfer_card (role: all)
        → 各节点独立转移
     → 卡牌效果结束
```

### 4.3 P2P同步

```
4节点独立执行 → 通过确定性保证一致性
  确定性来源:
    1. 相同seed的PRNG（Fisher-Yates洗牌、骰子结果一致）
    2. 相同action序列（通过广播对齐）
    3. 相同规则（所有节点跑同一份engine代码）

  仅需广播:
    - 骰子最终点数（物理摇盅的确定性结果）
    - 玩家选择（选牌、选位置、选方向）
    - 比武卡使用确认
    - 位置卡查询结果

  不需要广播:
    - 移动步数计算（各节点独立算）
    - 命中判定（各节点独立算）
    - 金币/属性变化（各节点独立算）
    - 抽卡结果（各节点独立算，seed保证一致）
```

---

## 5. 测试策略

### 5.1 单元测试

框架：Node.js 内置 `node:test` + `node:assert`

**卡牌解释器测试** — 每张卡牌至少一个测试用例：

```javascript
// test/card-interpreter.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { GameEngine } from '../engine/game-engine.js'

describe('事件#3 - 掠夺', () => {
  it('应让骰子最大的玩家从骰子最小的玩家处夺取1张招式卡', () => {
    // 初始化引擎
    const engine = new GameEngine({ seed: 42, mode: 'standard', talent: false })
    engine.init()
    
    // 手动设置骰子结果：A=6, B=2, C=4, D=1
    engine.players.A.hand.move.push(cardEngine.loadCard('move_001'))
    engine.players.D.hand.move.push(cardEngine.loadCard('move_007'))
    
    // 触发事件#3
    engine.applyAction({
      type: 'TRIGGER_EVENT',
      cardId: 'event_003',
      playerId: 'A'
    })
    
    // A骰=6(最大) 从 D骰=1(最小) 夺取
    assert.strictEqual(engine.players.A.hand.move.length, 2)
    assert.strictEqual(engine.players.D.hand.move.length, 0)
  })
})
```

### 5.2 状态一致性测试

确保P2P架构下4个节点独立运算结果一致：

```javascript
// test/consistency.test.js
describe('P2P状态一致性', () => {
  it('同一seed和action序列下所有引擎实例状态一致', () => {
    const engineA = new GameEngine({ seed: 12345 })
    const engineB = new GameEngine({ seed: 12345 })
    engineA.init()
    engineB.init()
    
    const actions = mockGenerateActions(50) // 生成50步随机操作
    
    for (const action of actions) {
      engineA.applyAction(action)
      engineB.applyAction(action)
    }
    
    assert.deepStrictEqual(engineA.getState(), engineB.getState())
  })
})
```

### 5.3 Monte Carlo 集成测试

```javascript
// sim/simulator.js
/**
 * Monte Carlo 模拟器
 * 复用game-engine.js，模拟AI玩家自主决策。
 * 用不同seed跑N局游戏，收集统计数据。
 */
class Simulator {
  run(config, games) {
    // 跑N局游戏
    // 每局用不同seed
    // 收集: 胜者、最终属性、金币、使用的招式等
  }
  
  analyze(results) {
    // 计算:
    // - 每种宠物的胜率
    // - 每种内功的使用率
    // - 每张招式卡的命中效率
    // - 金币分布
    // - 平均游戏时长（回合数）
    // - 不同配置（标准/杀戮/天赋）的平衡性
  }
}
```

---

## 6. 本地化（i18n）

### 6.1 文件位置

```
app/locales/
├── zh-CN.json  // 简体中文（默认）
├── en-US.json  // 英文
├── ja-JP.json  // 日语（预留）
└── ...         // 其他语言
```

### 6.2 JSON结构

```json
{
  "card": {
    "event_003": {
      "name": "掠夺",
      "description": "投骰子最大的玩家从最小的玩家处夺取1张招式卡"
    },
    "move_007": {
      "name": "左右横向两格"
    }
  },
  "system": {
    "dice_roll": "{player} 投骰子 → {value}",
    "advance": "{player} 前进至 {cellName}"
  },
  "grid": {
    "0": "休整", "1": "机遇"
  },
  "ui": {
    "create_room": "创建房间",
    "start_game": "开始游戏"
  }
}
```

### 6.3 加载器

```javascript
// engine/i18n.js
/**
 * @class I18nManager
 * @description 本地化管理器。引擎层不调用i18n，UI层必须通过此管理器查询。
 * 语言选择：浏览器语言偏好 → 自定义设置 → 默认中文
 */
class I18nManager {
  // 方法: t(path, params)  → 返回已替换的字符串
  // 方法: setLocale(locale) → 切换语言
}
```

### 6.4 降级策略

- 首选：浏览器语言匹配 (`zh-CN`, `en-US`)
- 次选：自定义设置（用户手动选择）
- 最终fallback：`en-US`（无对应的语言文件时）
- 缺失key的fallback：返回key路径本身（便于调试）

---

## 7. 编码规范

### 7.1 文件格式
- **编码**：UTF-8（无BOM）
- **换行**：LF（Unix风格）
- **缩进**：2空格
- **引号**：单引号优先
- **分号**：必须

### 7.2 注释规范

```javascript
/**
 * @class ClassName
 * @description 类的中文说明，什么功能、什么场景用
 */

/**
 * @method methodName
 * @param {type} paramName — 参数说明
 * @param {type} paramName — {options} 可选参数的说明
 * @returns {type} — 返回值说明
 * @description 方法的中文说明
 */

// 关键逻辑处的行内注释
// 例如: // 检查是否轮空 debuff
```

### 7.3 命名规范
- **类名**：PascalCase
- **方法/变量**：camelCase
- **常量**：UPPER_SNAKE_CASE
- **私有属性**：`#` 前缀（ES2022私有字段）

---

## 8. 开发顺序

### Phase 1：数值验证（纯Node.js，无UI/无网络）

```
第1步: Player.js + Board.js (1天)
  → 测试: 玩家初始化、棋盘格类型、前进/距离运算

第2步: EffectManager.js + TurnManager.js (1天)
  → 测试: 效果挂载/消耗、回合推进、跳回合

第3步: CardInterpreter.js (2天)
  → 测试: 每张卡牌效果的JSON解释
  → 先写机遇卡（单玩家，简单）→ 内功卡 → 事件卡（多人）→ 招式卡（无steps）

第4步: GameEngine.js (3天)
  → 串联Player/Board/TurnManager/EffectManager/CardInterpreter
  → 测试: 完整游戏流程（跑圈+修炼+抽卡）
  → 测试: P2P状态一致性

第5步: CombatSystem.js (3天，与第4步部分并行)
  → 测试: 六边形命中计算、缩圈、比武卡效果

第6步: Simulator.js (2天)
  → Monte Carlo 模拟器
  → 分析脚本

第7步: 分析报告
  → 数值平衡结论
  → 是否调整卡牌数值
```

### Phase 2+：UI + 网络（Phase 1 验证通过后）

```
第8步: Rust 信令服务器
第9步: WebRTC + 同步框架
第10步: 3D建模（宠物/桌景/兜帽人）
第11步: Three.js 场景
第12步: UI组件（信息栏/计分器/浮空选牌）
...
```

---

## 9. 更新规范

每写完一个文件，必须更新：

1. **`tasks/TASKBOARD.md`** — 对应任务的 ⚪ → ✅ 状态变更
2. **`artifacts/FILE_INDEX.md`** — 新增文件+更新文件总数
3. **`app/test/`** — 对应的测试文件
4. **`app/README.md`** — 如果新增了开发说明

**开发期间**及时更新 `tasks/DEV_CHECKLIST.md`（本文件衍生出的开发进度清单）。
