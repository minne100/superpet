# 卡牌引擎 Json 规则设计 — 以事件#3为例

## 1. 事件#3 规则原文

> 投骰子最大的玩家从最小的玩家处夺取1张招式卡（对方无则忽略）

## 2. 最终版 Json 定义

```json
{
  "cardId": "event_003",
  "type": "event",
  "description": "投骰子最大的玩家从最小的玩家处夺取1张招式卡（对方无则忽略）",
  "steps": [
    {
      "id": "notify",
      "action": "notify_all",
      "role": "all"
    },
    {
      "id": "dice_loop",
      "action": "loop",
      "who": "$all",
      "as": "p",
      "do": [
        {
          "id": "roll_{p}",
          "role": {
            "target": { "player": "{p}", "action": "roll_dice" },
            "others": { "action": "wait_dice", "from": "{p}" }
          },
          "on_receive": {
            "message_type": "dice_result",
            "filter": { "sender": "{p}" },
            "handle": { "action": "store", "as": "dice_{p}", "value": "msg.value" }
          }
        }
      ]
    },
    {
      "id": "calc_winner",
      "action": "calc",
      "expression": "find_max_min(dice_A, dice_B, dice_C, dice_D)",
      "store": { "max": "$winner", "min": "$loser" },
      "role": "all",
      "tie": { "goto": "dice_loop" }
    },
    {
      "id": "check_loser_hand",
      "action": "has_cards?",
      "who": "$loser",
      "card_type": "move",
      "min": 1,
      "role": "all",
      "fail": { "goto": "end" }
    },
    {
      "id": "winner_select",
      "role": {
        "actor": {
          "player": "$winner",
          "action": "reveal_and_pick",
          "source": "$loser",
          "filter": "move_only"
        },
        "target": {
          "player": "$loser",
          "action": "wait_pick"
        },
        "others": {
          "action": "wait"
        }
      },
      "on_receive": {
        "message_type": "card_selection",
        "filter": { "sender": "$winner", "cardId": "event_003" },
        "handle": { "action": "store", "as": "$chosen", "value": "msg.chosenCard" }
      }
    },
    {
      "id": "transfer_card",
      "action": "transfer_card",
      "from": "$loser", "to": "$winner", "card": "$chosen",
      "role": "all"
    }
  ]
}
```

## 3. 涉及的变量体系

| 符号 | 含义 | 例子 |
|---|---|---|
| `$all` | 保留字：所有活跃玩家ID数组 | — |
| `$trigger` | 保留字：触发该卡牌的玩家ID | — |
| `$xxx` | 卡牌级变量，跨 step 共享 | `$winner`, `$chosen` |
| `dice_A` | 步骤内变量，对应玩家A的骰子结果 | `dice_A`, `dice_B` |
| `{xxx}` | 字符串插值 | `{p}` 展开为当前玩家ID |
| `msg.xxx` | 广播消息中的字段引用 | `msg.value`, `msg.sender` |

## 4. 操作原语清单

| 原语 | 参数 | 行为 | 是否需网络 |
|---|---|---|---|
| `notify_all` | 无参数 | 通知所有玩家（UI层查本地化表显示文案） | ❽ 仅UI |
| `loop` | who, as, do | 循环处理玩家列表 | ❽ 引擎内部 |
| `roll_dice` | 无参数 | 当前玩家投骰 | ✅ 等待玩家输入 |
| `wait_dice` | from | 等待指定玩家投骰 | ✅ 等待广播消息 |
| `calc` | expression, store | 表达式计算并存储结果 | ❽ 引擎内部 |
| `has_cards?` | who, card_type, min | 检查玩家手牌 | ❽ 引擎内部 |
| `reveal_and_pick` | source, filter | 展示对方手牌并选择 | ✅ 单播+等待 |
| `wait_pick` | 无参数 | 等待被选 | ✅ 等待广播消息 |
| `transfer_card` | from, to, card | 转移卡牌 | ❽ 引擎内部 |
| `player_choice` | player, options | 玩家做二选一 | ✅ 等待玩家输入 |
| `negate_damage` | player | 抵消伤害 | ❽ 引擎内部 |
| `discard_card` | player, card? | 弃牌 | ❽ 引擎内部 |
| `add_gold` | target, value | 增加金币 | ❽ 引擎内部 |
| `broadcast` | message_type, ... | 广播消息（只传数据不传文本） | ✅ 网络发送 |
| `if` | condition, do | 条件分支 | ❽ 引擎内部 |
| `goto` | step_id | 跳转到指定step | ❽ 引擎内部 |
| `end` | 无参数 | 结束当前卡牌流程 | ❽ 引擎内部 |

## 5. 引擎执行流程

```
所有节点收到 card_triggered { cardId: "event_003" }
  ↓
每个节点加载 event_003.json
  ↓
每个节点初始化变量作用域
  ↓
每个节点逐条执行 steps，根据 role 决定自己的行为

  notify (role: all):       每个节点显示提示（UI层查本地化表）
  dice_loop (分角色):       每个节点等自己/别人投骰 → on_receive 对齐
  calc_winner (role: all):  各节点独立计算 → 确定性保证一致
  check_loser_hand (all):   各节点独立检查 → 一致
  winner_select (分角色):   actor(胜者)弹出选牌→广播选择→others/target收到
  transfer_card (all):      各节点独立转移
  ↓
所有 steps 执行完毕 → 卡牌效果结束
```

## 6. 其他卡牌类型示例

### 机遇卡
```json
{
  "cardId": "opportunity_03",
  "type": "opportunity",
  "description": "获得n金币，n=投骰子数值",
  "steps": [
    { "id": "s01", "action": "notify_all", "role": "all" },
    { "id": "s02", "action": "roll_dice", "role": { "target": { "player": "$trigger", "action": "roll_dice" }, "others": { "action": "wait_dice", "from": "$trigger" } }, "store_as": "$n" },
    { "id": "s03", "action": "add_gold", "target": "$trigger", "value": "$n", "role": "all" }
  ]
}
```

### 比武闪避卡
```json
{
  "cardId": "battle_dodge",
  "type": "battle",
  "description": "被击中时可以消耗此卡闪避本次攻击",
  "timing": "on_hit",
  "steps": [
    { "id": "s01", "action": "player_choice", "player": "{hit_player}", "options": ["yes","no"], "store_in": "$choice" },
    { "id": "s02", "action": "if", "condition": "$choice == 'yes'", "do": [
      { "id": "s02_a", "action": "negate_damage", "player": "{hit_player}" },
      { "id": "s02_b", "action": "discard_card", "player": "{hit_player}" },
      { "id": "s02_c", "action": "broadcast", "message_type": "dodge_used", "player": "{hit_player}" }
    ]}
  ]
}
```

## 7. 招式卡特殊处理

招式卡不描述"效果流程"，而是描述**六边形坐标偏移列表**，由 game-engine 的 combat.js 直接计算：
```json
{
  "cardId": "move_07",
  "type": "move",
  "description": "左右横向两格",
  "range": [ [0,-1,1], [0,1,-1] ]
}
```

## 8. Effect 系统（Debuff/状态挂载）

### 设计原则

不是回调，也不是遍历所有卡牌——**是 Effect Registry**。

每个玩家维护一个 Effects 数组，由 game-engine 的动作函数主动查询。

```json
// 玩家状态中的 effects
PlayerState.effects: [
  { "source": "opportunity_008", "effect": "skip_turn", "rounds": 1 },
  { "source": "opportunity_009", "effect": "cultivation_x2", "rounds": 1 },
  { "source": "opportunity_024", "effect": "dice_x2", "rounds": 1 }
]
```

### 挂载方式

卡牌 JSON 中的 `debuff` 原语向 effectManager 写入一条：

```json
{ "action": "debuff", "player": "$trigger", "effect": "skip_turn", "rounds": 1 }
```

### 触发机制

**不是遍历所有卡牌，也不是卡牌回调**——是引擎里的动作函数自己知道要去查。

```
function rollDice(player) {
  const m = effectManager.get(player, 'dice_half') ? 0.5
         : effectManager.get(player, 'dice_x2') ? 2
         : 1
  return Math.floor(Math.random() * 6 + 1) * m
}

function enterCultivation(player) {
  if (effectManager.get(player, 'cultivation_skip')) return  // 修炼无效，跳过
  const multi = effectManager.get(player, 'cultivation_x2') ? 2 : 1
  // ...正常修炼逻辑 × multi...
}

function drawCard(player, deck) {
  const extra = effectManager.get(player, 'extra_draw_move') ? 1 : 0
  return dealCards(player, deck, 1 + extra)
}

function nextTurn(player) {
  if (effectManager.get(player, 'skip_turn')) {
    effectManager.tick(player, 'skip_turn')
    return  // 跳过整个回合
  }
  // ...正常回合流程...
}

// 不同效果互斥 — enterCultivation 先查skip，再查x2，不会同时生效
```

### 效果消耗

- `rounds`: 剩余轮次，每轮 tick 减1，到0自动清除
- 即时消耗类（如 `dice_x2` 只用一次）：效果函数内部 `use()`，用完即消
- `effectManager.tick(player, effect)` — 减一回合轮次
- `effectManager.use(player, effect)` — 消耗一次，立即清除

### 涉及 Effect 检查的引擎函数清单

| 引擎函数 | 检查的 Effect | 影响 |
|---|---|---|
| `rollDice` | dice_x2, dice_half | 骰子点数乘数 |
| `advance` | next_turn_choose_step | 不投骰，手动选步数 |
| `enterCultivation` | cultivation_skip, cultivation_x2, rest_cultivate | 跳过/翻倍/休整时修炼 |
| `drawCard` (move deck) | extra_draw_move | 招式卡多抽1张 |
| `drawCard` (any deck) | redraw_once | 一次重抽机会 |
| `nextTurn` | skip_turn | 整轮跳过 |

## 9. 已确定的设计决策

| 决策 | 方案 |
|---|---|
| 变量作用域 | 卡牌级，执行完后清理 |
| 牌堆顺序 | seed + Fisher-Yates 开局锁定 |
| 弃牌与放回 | 弃牌=标记为丢弃；放回=选一张插回牌池，插入位置由种子计算 |
| 网络同步 | 引擎只产生广播消息，由上层网络层发送 |
| Effect系统 | 不是回调不是遍历，引擎函数主动查询 Effect Registry |
