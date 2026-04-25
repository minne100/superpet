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
    // Step 1: 投骰
    const diceResult = await this._rollDice()
    const steps = diceResult.value

    // Step 2: 处理前进（可能经过路口需要选择方向）
    await this._advance(steps)

    // Step 3: 处理格子效果中需要玩家选择的情况
    await this._handleCellChoices()
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
   * @description 前进。如果途经路口，挂起等待方向选择（AI自动决策）。
   */
  async _advance (steps) {
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
      const choice = await this._decideJunction(junction.pos, junction.options)
      choices.push(choice)
    }

    // 执行前进
    const result = this.engine.applyAction({
      type: 'ADVANCE',
      playerId: this.id,
      data: { steps, choices }
    })

    this.bus.broadcast(MSG.MOVE_RESULT, {
      playerId: this.id,
      steps,
      oldPos: result.oldPos,
      newPos: result.newPos,
      passedJunctions: result.passedJunctions,
      choices
    }, this.id)
  }

  /**
   * @method _decideJunction
   * @private
   * @param {number[]} junctionPos — 路口坐标
   * @param {number[][]} options — 可选方向列表（来自 board.getNextCells，含来路）
   * @returns {Promise<number>} — 选择的方向索引
   * @description AI决策：在路口选择前进方向。
   *
   * 策略（模拟人类直觉）：
   * 根据当前玩家状态动态调整权重，对每个方向做 BFS 评分，选最高分。
   *
   * 权重调整规则：
   * - 招式卡不足（<2张）→ 大幅提升 move 权重（没有招式就只能打自己位置）
   * - 攻防偏低（<10）→ 提升 cultivate / neigong 权重（需要修炼提升属性）
   * - 金币充裕（>20）→ 稍降 rest 权重（不缺金币就不用专门踩休整）
   */
  async _decideJunction (junctionPos, options) {
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

    // 获取最近一次投骰的步数作为预算（从引擎历史中找，找不到用3作为默认预算）
    const lastDice = this._lastDiceValue ?? 3

    // 用 board.bestDirection 对所有方向评分
    // prevPos 是来路（junctionPos 的来路），传 null 让路口返回所有方向
    const bestIdx = board.bestDirection(junctionPos, null, lastDice, weights)

    return bestIdx
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
