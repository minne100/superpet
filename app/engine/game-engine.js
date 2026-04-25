/**
 * @class GameEngine
 * @description 整个游戏的大脑。管理全部子系统，是engine/目录的唯一对外接口。
 *
 * 核心设计原则：
 * - applyAction(action) 是唯一公共入口
 * - 全确定性：相同seed+相同action序列→ 相同结果
 * - 引擎层不涉及UI/网络/I/O
 *
 * Action格式：
 * { type: "ROLL_DICE" | "SELECT_CARD" | "SELECT_PLAYER" | ...,
 *   playerId: "A",
 *   data: { ... }
 * }
 */
import { Player } from './player.js'
import { Board } from './board.js'
import { TurnManager } from './turn-manager.js'
import { EffectManager } from './effect-manager.js'
import { CardInterpreter } from './card-interpreter.js'
import { CombatSystem } from './combat-system.js'
import { createDeck } from './load-cards.js'

class GameEngine {
  /**
   * @param {Object} config
   * @param {number} [config.seed=Date.now()] — 随机种子
   * @param {string} [config.mode='standard'] — 'standard' | 'kill' 游戏模式
   * @param {boolean} [config.talent=false] — 是否开启天赋
   * @param {string[]} [config.playerIds=['A','B','C','D']] — 玩家ID列表
   * @param {string[]} [config.order] — 开局顺序（由投骰决定）
   */
  constructor (config = {}) {
    /** @type {Object} 游戏配置 */
    this.config = {
      seed: config.seed ?? Date.now(),
      mode: config.mode || 'standard',
      talent: config.talent ?? false,
      playerIds: config.playerIds || ['A', 'B', 'C', 'D'],
      order: config.order || []
    }

    /** @type {number} 确定性种子值 */
    this.seed = this.config.seed

    /** @type {Function} 确定性PRNG */
    this.rng = this.#createRng(this.seed)

    /** @type {Player[]} 玩家列表 */
    this.players = []

    /** @type {Board} 棋盘（45格田字格） */
    this.board = new Board()

    /** @type {TurnManager} 回合管理器 */
    this.turnManager = new TurnManager({ order: this.config.order })

    /** @type {EffectManager} 效果管理器 */
    this.effectManager = new EffectManager()

    /** @type {CardInterpreter} 卡牌解释器 */
    this.cardInterpreter = new CardInterpreter({ engine: this })
    this.combatSystem = new CombatSystem({ engine: this })

    /** @type {Object} 牌堆（洗牌完毕等待抽卡） */
    this.decks = {
      move: [],
      neigong: [],
      opportunity: [],
      event: [],
      battle: []
    }

    /** @type {Object} 弃牌堆 */
    this.discardPiles = {
      move: [],
      neigong: [],
      opportunity: [],
      event: [],
      battle: []
    }

    /** @type {Action[]} 全操作历史 */
    this.history = []

    /** @type {boolean} 游戏是否结束 */
    this.gameOver = false

    /** @type {string} 当前阶段 'init'|'run'|'combat'|'settlement' */
    this.phase = 'init'

    /** @type {number} 动作序列号 */
    this.seq = 0
  }

  /**
   * @method init
   * @description 初始化游戏：创建玩家、洗牌、开始第一轮
   * 返回初始状态快照
   */
  init () {
    const { playerIds, order } = this.config

    // 创建4个玩家
    this.players = playerIds.map(id => new Player({ id }))

    // 初始化回合顺序
    const effectiveOrder = order.length === 4 ? order : playerIds
    this.turnManager.init(effectiveOrder)

    // 洗牌所有牌堆
    this.decks.move = createDeck('move', this.#nextSeed())
    this.decks.neigong = createDeck('neigong', this.#nextSeed())
    this.decks.opportunity = createDeck('opportunity', this.#nextSeed())
    this.decks.event = createDeck('event', this.#nextSeed())
    // 比武卡牌堆（TODO: 洗牌逻辑）
    this.decks.battle = []

    // 每人发初始卡
    this.#dealInitialCards()

    this.phase = 'run'

    return this.getState()
  }

  /**
   * @method #dealInitialCards
   * @private
   * @description 每人发1张招式卡、2张内功卡
   */
  #dealInitialCards () {
    // 无初始手牌。攻防默认值=1由Player构造设定。
    return
  }

  /**
   * @method applyAction
   * @param {Action} action — 玩家操作
   * @returns {ActionResult}
   * @description 唯一公共入口。处理所有类型的操作。
   *
   * action.type:
   * - ROLL_DICE: 投骰
   * - ADVANCE: 前进
   * - TRIGGER_CARD: 触发卡牌效果
   * - SELECT_CARD: 选卡
   * - SELECT_PLAYER: 选择目标玩家
   * - CONFIRM: 确认/继续
   * - COMBAT_ACTION: 比武操作
   */
  applyAction (action) {
    if (this.gameOver) {
      return { success: false, error: '游戏已结束' }
    }

    const seq = this.seq++
    const fullAction = { ...action, seq }

    // 记录到历史
    this.history.push(fullAction)

    let result

    switch (action.type) {
      case 'ROLL_DICE':
        result = this.#handleRollDice(action)
        break
      case 'ADVANCE':
        result = this.#handleAdvance(action)
        break
      case 'TRIGGER_CARD':
        result = this.#handleTriggerCard(action)
        break
      case 'SELECT_CARD':
        result = this.#handleSelectCard(action)
        break
      case 'SELECT_PLAYER':
        result = this.#handleSelectPlayer(action)
        break
      case 'CONFIRM':
        result = this.#handleConfirm(action)
        break
      case 'NEXT_TURN':
        result = this.#handleNextTurn(action)
        break
      case 'COMBAT_ACTION':
        result = this.#handleCombatAction(action)
        break
      default:
        result = { success: false, error: `未知操作类型: ${action.type}` }
        return result
    }

    // 检查是否终局
    if (this.#checkGameOver()) {
      this.gameOver = true
      this.phase = 'settlement'
    }

    result.success = true
    result.gameOver = this.gameOver
    result.state = this.getState()
    return result
  }

  // ============ Action 处理函数 ============

  /**
   * @method #handleRollDice
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理投骰子结果
   */
  #handleRollDice (action) {
    const value = action.data?.value ?? this.#rollDice()
    return { type: 'ROLL_DICE', value, player: action.playerId }
  }

  /**
   * @method #handleAdvance
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理前进（田字格版本）
   *
   * action.data:
   * - steps: number — 骰子点数
   * - choices: number[] — 路口选择序列（每个路口选择哪个方向，索引从0开始）
   *   UI层在玩家遇到路口时暂停并收集选择，然后把完整choices数组一起发过来。
   *   模拟器自动随机生成choices。
   */
  #handleAdvance (action) {
    const player = this.#getPlayer(action.playerId)
    const steps = action.data?.steps ?? 1
    const choices = action.data?.choices ?? []
    const oldPos = player.position

    // 田字格前进：返回 { pos, passedJunctions }
    const { pos: newPos, passedJunctions } = this.board.advance(
      player.position, steps, choices
    )
    player.position = newPos

    // 触发终点格的格子效果
    const cellEvents = this.#triggerCellEffect(player, oldPos, newPos)

    return {
      type: 'ADVANCE',
      steps,
      oldPos,
      newPos,
      passedJunctions,
      cellEvents
    }
  }

  /**
   * @method #triggerCellEffect
   * @private
   * @param {Player} player — 触发玩家
   * @param {number} oldPos — 出发位置
   * @param {number} newPos — 到达位置
   * @returns {Object[]} — 触发的效果列表
   * @description 玩家到达格子时，根据格子类型触发对应效果。
   * 类型的分布（规则书 §3.1）：
   * - rest(休整): 无效果
   * - cultivate(修炼): 攻击+1, 防御+1（可用内功卡叠加）
   * - move(招式): 抽1张招式卡
   * - neigong(内功): 抽1张内功卡
   * - opportunity(机遇): 抽1张机遇卡并执行
   * - event(事件): 抽1张事件卡并执行
   * - battle(比武): 触发比武阶段（由上层游戏逻辑控制）
   */
  #triggerCellEffect (player, oldPos, newPos) {
    const cellType = this.board.getType(newPos)
    const events = []

    switch (cellType) {
      case 'rest': {
        // 休整格：获得2金币
        player.addGold(2)
        events.push({ type: 'rest_gold', gain: 2 })
        break
      }

      case 'cultivate': {
        // 修炼格：攻击+1, 防御+1
        player.modifyAttack(1)
        player.modifyDefense(1)
        let neigongUsed = null

        // 检查玩家是否持有内功卡，可用叠加修炼
        if (player.hand.neigong && player.hand.neigong.length > 0) {
          const neigongCard = player.hand.neigong[0]
          if (neigongCard.attackBonus || neigongCard.defenseBonus) {
            player.modifyAttack(neigongCard.attackBonus || 0)
            player.modifyDefense(neigongCard.defenseBonus || 0)
            neigongUsed = neigongCard.cardId
            // 内功卡使用后弃入弃牌堆
            player.removeCard('neigong', neigongCard.cardId)
          }
        }

        events.push({ type: 'cultivate', attackGain: 1, defenseGain: 1, neigongUsed })
        break
      }

      case 'move': {
        // 招式格：抽1张招式卡
        const card = this.decks.move.pop()
        if (card) {
          player.addCard('move', card)
          events.push({ type: 'draw_move', cardId: card.cardId })
        }
        break
      }

      case 'neigong': {
        // 内功格：抽1张内功卡
        const card = this.decks.neigong.pop()
        if (card) {
          player.addCard('neigong', card)
          events.push({ type: 'draw_neigong', cardId: card.cardId })
        }
        break
      }

      case 'opportunity': {
        // 机遇格：抽1张机遇卡并立即执行（规则书：机遇卡用完即弃）
        const card = this.decks.opportunity.pop()
        if (card) {
          player.addCard('opportunity', card)
          const result = this.cardInterpreter.interpret(card, {
            triggerPlayerId: player.id,
            engine: this
          })
          player.removeCard('opportunity', card.cardId)
          events.push({ type: 'opportunity_executed', cardId: card.cardId, result })
        }
        break
      }

      case 'event': {
        // 事件格：抽1张事件卡并立即执行（规则书：事件卡用完即弃）
        const card = this.decks.event.pop()
        if (card) {
          player.addCard('event', card)
          const result = this.cardInterpreter.interpret(card, {
            triggerPlayerId: player.id,
            engine: this
          })
          player.removeCard('event', card.cardId)
          events.push({ type: 'event_executed', cardId: card.cardId, result })
        }
        break
      }

      case 'battle': {
        // 比武格：触发简化的对战（模拟器模式快速推进）
        const battleResult = this.#resolveSimpleBattle(player)
        events.push({ type: 'battle', position: newPos, ...battleResult })
        break
      }

      default:
        break
    }

    return events
  }

  /**
   * @method #handleTriggerCard
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理卡牌触发
   */
  #handleTriggerCard (action) {
    const cardId = action.data?.cardId
    const context = {
      triggerPlayerId: action.playerId,
      playerOrder: this.turnManager.order
    }
    // 加载卡牌JSON并解释
    const { loadCard } = require('./load-cards.js')
    const cardJson = loadCard(cardId)
    const result = this.cardInterpreter.interpret(cardJson, context)
    return { type: 'CARD_TRIGGER', cardId, result }
  }

  /**
   * @method #handleSelectCard
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理选牌
   */
  #handleSelectCard (action) {
    const { cardType, cardId } = action.data || {}
    return { type: 'SELECT_CARD', cardType, cardId }
  }

  /**
   * @method #handleSelectPlayer
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理选择目标玩家
   */
  #handleSelectPlayer (action) {
    return { type: 'SELECT_PLAYER', targetId: action.data?.targetId }
  }

  /**
   * @method #handleConfirm
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理确认/继续
   */
  #handleConfirm (action) {
    return { type: 'CONFIRM' }
  }

  /**
   * @method #handleNextTurn
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理轮到下一玩家
   */
  #handleNextTurn (action) {
    const shouldSkip = (pid) => this.effectManager.get(pid, 'skip_turn')
    const result = this.turnManager.nextTurn(shouldSkip)
    this.effectManager.tickAll()
    return { type: 'NEXT_TURN', ...result }
  }

  /**
   * @method #handleCombatAction
   * @private
   * @param {Action} action
   * @returns {Object}
   * @description 处理比武动作（占位）
   */
  #handleCombatAction (action) {
    return { type: 'COMBAT_ACTION' }
  }

  // ============ 查询方法 ============

  /**
   * @method getPlayer
   * @param {string} playerId
   * @returns {Player|undefined}
   * @description 获取指定玩家
   */
  getPlayer (playerId) {
    return this.players.find(p => p.id === playerId)
  }

  /**
   * @method getState
   * @returns {Object} — 完整游戏状态快照
   * @description 获取当前游戏完整状态（用于调试/序列化）
   */
  getState () {
    return {
      phase: this.phase,
      gameOver: this.gameOver,
      round: this.turnManager.round,
      currentPlayer: this.turnManager.getCurrentPlayer(),
      players: this.players.map(p => p.toJSON()),
      board: this.board.toJSON(),
      turnManager: this.turnManager.toJSON(),
      effects: this.effectManager.toJSON(),
      deckSizes: {
        move: this.decks.move.length,
        neigong: this.decks.neigong.length,
        opportunity: this.decks.opportunity.length,
        event: this.decks.event.length,
        battle: this.decks.battle.length
      },
      historyLength: this.history.length
    }
  }

  /**
   * @method isGameOver
   * @returns {boolean}
   */
  isGameOver () {
    return this.gameOver
  }

  /**
   * @method getValidActions
   * @param {string} playerId
   * @returns {string[]} — 可用的操作类型列表
   * @description 获取玩家当前可用的操作（AI决策用）
   */
  getValidActions (playerId) {
    if (this.gameOver) return []
    if (this.phase === 'combat') {
      return ['COMBAT_ACTION', 'SELECT_CARD', 'SELECT_PLAYER', 'CONFIRM']
    }
    return ['ROLL_DICE', 'CONFIRM', 'SELECT_CARD']
  }

  /**
   * @method getResult
   * @returns {Object|null}
   * @description 终局结果（排名）
   */
  getResult () {
    if (!this.gameOver) return null
    const sorted = [...this.players].sort((a, b) => {
      // 排序标准：存活>金币>攻击>防御
      if (a.alive !== b.alive) return b.alive - a.alive
      if (a.gold !== b.gold) return b.gold - a.gold
      if (a.attack !== b.attack) return b.attack - a.attack
      return b.defense - a.defense
    })
    return sorted.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      gold: p.gold,
      attack: p.attack,
      defense: p.defense
    }))
  }

  /**
   * @method calcExpression
   * @param {string} expression — 表达式字符串
   * @param {Object} context — 执行上下文
   * @returns {Object} — 计算结果
   * @description 计算卡牌引擎中的表达式（由CardInterpreter调用）
   */
  calcExpression (expression, context) {
    // 简化的表达式计算
    if (expression === 'find_max_min(dice)') {
      const dice = context.diceResults || {}
      let maxPlayer = null; let maxVal = -1
      let minPlayer = null; let minVal = 999
      for (const [pid, val] of Object.entries(dice)) {
        if (val > maxVal) { maxVal = val; maxPlayer = pid }
        if (val < minVal) { minVal = val; minPlayer = pid }
      }
      return { max_player: maxPlayer, min_player: minPlayer }
    }
    return {}
  }

  // ============ 内部工具 ============

  /**
   * @method #getPlayer
   * @private
   */
  #getPlayer (playerId) {
    return this.players.find(p => p.id === playerId)
  }

  /**
   * @method #rollDice
   * @private
   * @returns {number} — 1~6的骰子结果
   * @description 用确定性PRNG投骰
   */
  #rollDice () {
    return Math.floor(this.rng() * 6) + 1
  }

  /**
   * @method #createRng
   * @private
   * @param {number} seed
   * @returns {Function}
   * @description 创建线性同余PRNG
   */
  #createRng (seed) {
    let s = seed % 2147483647
    if (s <= 0) s += 2147483646
    return () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }
  }

  /**
   * @method #nextSeed
   * @private
   * @returns {number}
   * @description 消耗一次rng，生成一个整数种子
   */
  #nextSeed () {
    return Math.floor(this.rng() * 2147483646) + 1
  }

  /**
   * @method #startBattlePhase
   * @private
   * @param {string[]} triggerPlayerIds — 触发比武的玩家ID列表
   * @returns {Object} 比武结果摘要
   * @description 启动完整比武阶段（37格对战盘+招式范围+缩圈+结算）
   * 在模拟器模式下自动运行完整比武流程。
   */
  #startBattlePhase (triggerPlayerIds) {
    // 所有存活玩家参与比武
    const allAlive = this.players.filter(p => p.alive).map(p => p.id)

    // 启动比武系统
    this.combatSystem.startBattle(allAlive, { engine: this })
    this.phase = 'combat'

    // 自动运行完整比武
    return this.#autoRunBattle()
  }

  /**
   * @method #resolveSimpleBattle
   * @private
   * @param {Player} triggerPlayer — 踩中比武格的玩家
   * @returns {Object} 比武结果
   * @description 简化比武（模拟器模式使用）
   */

  /**
   * @method #autoRunBattle
   * @private
   * @returns {Object} 比武结果摘要
   * @description （模拟器模式）自动运行完整比武直到结束
   */
  #autoRunBattle () {
    const rounds = []

    while (!this.combatSystem.isOver) {
      // 获取当前出手玩家
      const pid = this.combatSystem.getCurrentPlayer()
      if (!pid) {
        this.combatSystem.checkEndOfBattle()
        break
      }

      const state = this.combatSystem.battleState[pid]
      if (!state || !state.alive) {
        this.combatSystem.endTurn()
        continue
      }

      // 检查是否有招式卡，有则攻击，无则跳过
      const player = this.getPlayer(pid)
      const hasMove = player && player.hand.move && player.hand.move.length > 0

      if (hasMove) {
        const attackResult = this.combatSystem.handleAction({
          type: 'ATTACK',
          playerId: pid
        })

        rounds.push({
          player: pid,
          round: this.combatSystem.round,
          action: 'ATTACK',
          hits: attackResult.hits || [],
          usedCard: attackResult.usedCard
        })
      } else {
        rounds.push({
          player: pid,
          round: this.combatSystem.round,
          action: 'NO_MOVE',
          hits: []
        })
      }

      // 自动移动（随机方向）
      const adjacents = this.combatSystem.board.getAdjacent(state.pos)
      if (adjacents.length > 0 && this.combatSystem.board.getActiveCellCount() > 1) {
        // 随机找空位移动
        const free = adjacents.filter(pos => {
          return !Object.values(this.combatSystem.battleState)
            .some(s => s.alive && s.pos === pos && s.id !== pid)
        })
        if (free.length > 0) {
          const target = free[Math.floor(free.length / 2)]
          const oldPos = state.pos
          state.pos = target
          rounds.push({
            player: pid,
            action: 'MOVE',
            from: oldPos,
            to: target
          })
        }
      }

      this.combatSystem.endTurn()
    }

    // 比武结算
    const settlement = this.combatSystem.settleBattle()

    // 执行金币转移
    if (settlement.transfers) {
      for (const t of settlement.transfers) {
        const fromP = this.getPlayer(t.from)
        const toP = this.getPlayer(t.to)
        if (fromP && toP) {
          const actual = fromP.removeGold(t.amount)
          toP.addGold(actual)
        }
      }
    }

    // 恢复跑圈阶段
    this.phase = 'run'

    // 恢复生存玩家的攻防（临战属性不保留到跑圈）
    // 规则：比武中临战属性变化不影响永久属性

    return {
      type: 'full_battle',
      totalRounds: this.combatSystem.round,
      victorId: settlement.victor,
      allDead: settlement.allDead,
      participants: this.players.filter(p => p.alive).length > 0 ?
        this.players.filter(p => p.alive).map(p => ({ id: p.id, gold: p.gold })) :
        [],
      roundsSummary: rounds.length + '个行动'
    }
  }

  #resolveSimpleBattle (triggerPlayer) {
    // 找到最近的对手（曼哈顿距离）
    const opponents = this.players
      .filter(p => p.id !== triggerPlayer.id)
      .sort((a, b) => {
        const dA = this.board.getDistance(triggerPlayer.position, a.position)
        const dB = this.board.getDistance(triggerPlayer.position, b.position)
        return dA - dB
      })

    const target = opponents[0]
    if (!target) {
      return { outcome: 'no_opponent' }
    }

    // 双方各投骰决定先后手
    const triggerRoll = Math.floor(this.rng() * 6) + 1
    const targetRoll = Math.floor(this.rng() * 6) + 1

    let attacker, defender
    if (triggerRoll >= targetRoll) {
      attacker = triggerPlayer
      defender = target
    } else {
      attacker = target
      defender = triggerPlayer
    }

    // 第一回合：攻击方对防守方造成 attack 点伤害
    const firstDamage = Math.max(0, attacker.attack - defender.defense)
    defender.defense = Math.max(0, defender.defense - attacker.attack)

    // 如果防守方没倒，防守方反击
    let secondDamage = 0
    let victor = null
    let loser = null

    if (defender.defense > 0 && defender.attack > 0) {
      secondDamage = Math.max(0, defender.attack - attacker.defense)
      attacker.defense = Math.max(0, attacker.defense - defender.attack)

      if (attacker.defense <= 0) {
        victor = defender
        loser = attacker
      } else {
        victor = attacker
        loser = defender
      }
    } else if (defender.defense <= 0) {
      victor = attacker
      loser = defender
    } else {
      victor = attacker
      loser = defender
    }

    // 金币转移
    const goldTransfer = 1
    if (loser && victor) {
      const actual = loser.removeGold(goldTransfer)
      victor.addGold(actual)
    }

    return {
      outcome: victor ? (victor.id === triggerPlayer.id ? 'win' : 'lose') : 'draw',
      opponentId: target.id,
      attackerId: attacker.id,
      firstDamage,
      secondDamage,
      goldTransfer: victor ? 1 : 0,
      victorId: victor?.id || null,
      loserId: loser?.id || null
    }
  }

  /**
   * @method #checkGameOver
   * @private
   * @returns {boolean}
   * @description 检查是否满足终局条件
   */
  #checkGameOver () {
    // 杀戮局：只剩1个存活玩家
    if (this.config.mode === 'kill') {
      const alive = this.players.filter(p => p.alive)
      return alive.length <= 1
    }
    // 标准局：招式卡牌堆抽空时触发终局
    if (this.decks.move.length === 0) {
      return true
    }
    return false
  }
}

/**
 * @typedef {Object} Action
 * @property {string} type — 操作类型
 * @property {string} playerId — 执行玩家
 * @property {Object} [data] — 操作数据
 * @property {number} [seq] — 序列号
 */

/**
 * @typedef {Object} ActionResult
 * @property {boolean} success
 * @property {Object} state
 * @property {boolean} gameOver
 * @property {string} [error]
 */

export { GameEngine }
