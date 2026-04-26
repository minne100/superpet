/**
 * @class PlayerAgent
 * @description 单个玩家的自主决策主体。
 *
 * 每个 Agent 是一个独立的 async 协程：
 *   agent.run() 返回一个 Promise，在游戏结束前持续运行。
 *   遇到需要等待的情况（别人投骰、别人出招）时挂起，
 *   收到消息后自动唤醒，继续决策。
 *
 * 将来 AI 托管（掉线替代）：
 *   直接用这个类接管掉线玩家，行为完全一致。
 *   只需把 this._decide*() 系列方法替换为更聪明的策略即可。
 *
 * 将来真实玩家（在线版）：
 *   创建一个 HumanPlayerAgent 继承此类，
 *   把 _decide*() 方法改为通过 WebRTC 消息等待玩家输入。
 *
 * @param {string} playerId — 玩家ID（'A'|'B'|'C'|'D'）
 * @param {import('./game-bus.js').GameBus} bus — 消息总线
 * @param {import('../engine/game-engine.js').GameEngine} engine — 游戏引擎（只读）
 */

import { MSG } from './game-bus.js'
import { Board } from '../engine/board.js'

export class PlayerAgent {
  constructor (playerId, bus, engine) {
    /** @type {string} */
    this.id = playerId
    /** @type {import('./game-bus.js').GameBus} */
    this.bus = bus
    /** @type {import('../engine/game-engine.js').GameEngine} */
    this.engine = engine
    /** @type {boolean} 游戏是否结束 */
    this._done = false
  }

  /**
   * @method run
   * @returns {Promise<void>}
   * @description Agent 主循环。
   * 等待 GAME_START → 进入回合循环 → 收到 GAME_OVER 时退出。
   *
   * 主循环模式：
   *   1. 等待 YOUR_TURN 或 GAME_OVER
   *   2. 如果是 GAME_OVER → 退出
   *   3. 如果是 YOUR_TURN → 执行自己的回合
   *   4. 同时监听其他玩家的广播消息（投骰/移动/出招），更新本地视图
   */
  async run () {
    // 先注册等待，再发就绪信号
    // 顺序重要：waitForType 先把 waiter 挂入队列，才能接收后续 GAME_START
    const gameStartPromise = this.bus.waitForType(this.id, MSG.GAME_START)

    // 通知 Coordinator：本 Agent 的 GAME_START waiter 已注册完毕
    this.bus.broadcast(MSG.AGENT_READY, { playerId: this.id }, this.id)

    // 等待游戏开始
    await gameStartPromise

    while (!this._done) {
      // 等待"轮到你"（单播）或"游戏结束"（广播）
      const msg = await this.bus.waitForTypes(this.id, [MSG.YOUR_TURN, MSG.GAME_OVER])

      if (msg.type === MSG.GAME_OVER) {
        this._done = true
        break
      }

      // 执行自己的回合
      await this._takeTurn()

      // 回合结束，通知总线（广播，让 Coordinator 的 waitFor 收到）
      this.bus.broadcast(MSG.TURN_END, { playerId: this.id }, this.id)
    }
  }

  /**
   * @method _takeTurn
   * @private
   * @description 执行一个完整回合：投骰 → 处理路口 → 处理格子效果。
   */
  async _takeTurn () {
    const player = this.engine.getPlayer(this.id)

    let steps
    let usedChooseStep = false
    const hasChooseStep = this.engine.effectManager.get(this.id, 'next_turn_choose_step')
    
    if (hasChooseStep) {
      this.engine.effectManager.clear(this.id, 'next_turn_choose_step')
      steps = await this._decideOptimalSteps()
      usedChooseStep = true
      console.log(`[LOG] ${this.id} 自主选择 ${steps} 步`)
    } else {
      const diceResult = await this._rollDice()
      steps = diceResult.value
    }

    // Step 2: 处理前进（可能经过路口需要选择方向）
    await this._advance(steps, usedChooseStep)

    // Step 3: 处理格子效果中需要玩家选择的情况
    await this._handleCellChoices()
  }

  /**
   * @method _decideOptimalSteps
   * @private
   * @returns {Promise<number>}
   * @description 不投骰，根据权重计算最优步数（1-6）
   */
  async _decideOptimalSteps () {
    const player = this.engine.getPlayer(this.id)
    const board = this.engine.board
    const weights = { ...Board.DEFAULT_WEIGHTS }

    const moveCardCount = player.hand.move?.length ?? 0
    if (moveCardCount < 2) {
      weights.move = 20 + (2 - moveCardCount) * 10
    }
    if (player.attack < 10 || player.defense < 10) {
      weights.cultivate = 8
      weights.neigong = 7
    }
    if (player.gold > 20) {
      weights.rest = 1
    }

    let bestSteps = 1
    let bestScore = -Infinity

    for (let s = 1; s <= 6; s++) {
      const result = board.advance(player.position, s, player.prevPosition, [])
      const cellType = board.getType(result.pos)
      const score = weights[cellType] ?? 0

      if (score > bestScore) {
        bestScore = score
        bestSteps = s
      }
    }

    return bestSteps
  }

  /**
   * @method _rollDice
   * @private
   * @returns {Promise<{value: number}>}
   * @description 投骰并广播结果
   */
  async _rollDice () {
    const result = this.engine.applyAction({
      type: 'ROLL_DICE',
      playerId: this.id
    })
    // 记录骰子值，供 _decideJunction 做路径评分时用作步数预算
    this._lastDiceValue = result.value
    this.bus.broadcast(MSG.DICE_RESULT, {
      playerId: this.id,
      value: result.value
    }, this.id)
    return result
  }

  /**
   * @method _advance
   * @private
   * @param {number} steps — 前进步数
   * @param {boolean} [usedChooseStep=false] — 是否使用自由选择步数
   * @description 前进。如果途经路口，挂起等待方向选择（AI自动决策）。
   */
  async _advance (steps, usedChooseStep = false) {
    const player = this.engine.getPlayer(this.id)

    // 预判本次前进会经过哪些路口（dry-run）
    const preview = this.engine.board.advance(
      player.position,
      steps,
      player.prevPosition,
      []  // 空choices，全部取默认索引0，只是为了得到路口列表
    )

    // 为每个路口做一次决策
    const choices = []
    for (const junction of preview.passedJunctions) {
      const choice = await this._decideJunction(junction.pos, junction.options, junction.stepsLeft)
      choices.push(choice)
    }

    // 判断落点格子类型，若是修炼格则决策加攻/加防及是否用内功卡
    const { pos: landingPos } = this.engine.board.advance(
      player.position, steps, player.prevPosition, choices
    )
    const landingType = this.engine.board.getType(landingPos)

    let cultivateStat = 'attack'
    let neigongCardId = null

    if (landingType === 'cultivate') {
      const opts = this._decideCultivate(player)
      cultivateStat = opts.stat
      neigongCardId = opts.neigongCardId
    }

    // 执行前进
    const result = this.engine.applyAction({
      type: 'ADVANCE',
      playerId: this.id,
      data: { steps, choices, cultivateStat, neigongCardId }
    })

this.bus.broadcast(MSG.MOVE_RESULT, {
      playerId: this.id,
      steps,
      oldPos: result.oldPos,
      newPos: result.newPos,
      passedJunctions: result.passedJunctions,
      choices,
      usedChooseStep,
      cellEvents: result.cellEvents ?? []
    }, this.id)
  }

/**
   * @method _decideJunction
   * @private
   * @param {number[]} junctionPos — 路口坐标
   * @param {number[][]} options — 可选方向列表（来自 board.getNextCells，含来路）
   * @param {number} stepsLeft — 剩余步数预算
   * @returns {Promise<number>} — 选择的方向索引
   * @description AI决策：在路口选择前进方向。
   *
   * 策略（模拟人类直觉）：
   * 根据玩家状态动态调整权重，对每个方向做 BFS 评分，选最高分。
   *
   * 权重调整规则：
   * - 招式卡不足（<2张）→ 大幅提升 move 权重（没有招式就只能打自己位置）
   * - 属性偏低（攻击<10 或 防御<10）→ 提升 cultivate/neigong 权重
   * - 金币充裕（>20）→ 降低 rest 权重
   */
  async _decideJunction (junctionPos, options, stepsLeft = 3) {
    if (options.length <= 1) return 0

    const player = this.engine.getPlayer(this.id)
    const board = this.engine.board

    // 根据玩家状态动态调整权重
    const weights = { ...Board.DEFAULT_WEIGHTS }

    const moveCardCount = player.hand.move?.length ?? 0
    if (moveCardCount < 2) {
      // 没招式很被动，强烈偏向招式格
      weights.move = 20 + (2 - moveCardCount) * 10
    }

    if (player.attack < 10 || player.defense < 10) {
      // 属性偏低，多修炼
      weights.cultivate = 8
      weights.neigong = 7
    }

    if (player.gold > 20) {
      // 金币充裕，休整格价值降低
      weights.rest = 1
    }

    // 用 board.bestDirection 对所有方向评分（路口允许掉头，所以不过滤来路）
    const bestIdx = board.bestDirection(junctionPos, null, stepsLeft, weights)

    return bestIdx
  }

  /**
   * @method _decideCultivate
   * @private
   * @param {Object} player — 当前玩家状态
   * @returns {{ stat: string, neigongCardId: string|null }}
   * @description AI决策：修炼格选择加攻还是加防，以及是否使用内功卡。
   *
   * 策略：
   * - 优先使用内功卡（数值更高）：选攻击型还是防御型由当前属性差值决定
   * - 无内功卡：攻防差距大的那个优先补
   * - 攻防差距小时（≤2）：优先加攻（攻击在比武中更主动）
   */
  _decideCultivate (player) {
    const neigongCards = player.hand.neigong ?? []

    // 分出攻击型和防御型内功卡，选最大值的那张
    const atkCards = neigongCards
      .filter(c => c.steps?.[0]?.stat === 'attack')
      .sort((a, b) => (b.steps[0].value) - (a.steps[0].value))
    const defCards = neigongCards
      .filter(c => c.steps?.[0]?.stat === 'defense')
      .sort((a, b) => (b.steps[0].value) - (a.steps[0].value))

    if (atkCards.length > 0 || defCards.length > 0) {
      // 有内功卡：选对当前属性提升最有价值的方向
      // 攻守差距大的那方用内功卡加成更值，差距小时优先攻击
      const needsAtk = player.attack <= player.defense
      if (needsAtk && atkCards.length > 0) {
        return { stat: 'attack', neigongCardId: atkCards[0].cardId }
      }
      if (!needsAtk && defCards.length > 0) {
        return { stat: 'defense', neigongCardId: defCards[0].cardId }
      }
      // 单方向有卡，使用现有方向
      if (atkCards.length > 0) return { stat: 'attack', neigongCardId: atkCards[0].cardId }
      if (defCards.length > 0) return { stat: 'defense', neigongCardId: defCards[0].cardId }
    }

    // 无内功卡：攻守差距大时补弱的，差距小时优先攻击
    const stat = (player.defense - player.attack >= 3) ? 'defense' : 'attack'
    return { stat, neigongCardId: null }
  }

  /**
   * @method _handleCellChoices
   * @private
   * @description 处理格子效果中需要玩家交互的部分（选牌、确认等）。
   *
   * Phase 1（模拟器）：格子效果由引擎内部自动处理，此处无需等待。
   * Phase 2（在线版）：当引擎需要玩家做选择时（如选择弃哪张牌），
   *   会通过总线发送 CARD_CHOICE 单播消息，Agent 再响应。
   *   届时修改此方法为：等待 CELL_EFFECT_DONE 广播（由 Coordinator 发出）。
   */
  async _handleCellChoices () {
    // Phase 1: 无需等待，引擎内部已处理所有格子效果
    // 让出一次事件循环，保持协程语义正确
    await Promise.resolve()
  }

  /**
   * @method _decideCardChoice
   * @private
   * @param {Object} payload — 选牌上下文
   * @returns {Promise<any>} — 选择结果
   * @description AI决策：面对卡牌选择时的策略。
   * 默认：选第一个选项。
   */
  async _decideCardChoice (payload) {
    const options = payload.options || []
    return options[0] ?? null
  }
}
