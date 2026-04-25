/**
 * @class TurnManager
 * @description 控制跑圈阶段的回合顺序和轮次管理。
 *
 * 回合流程：
 * 1. 确定当前玩家（跳过skipNextTurn=true的玩家）
 * 2. 玩家投骰子 → 前进 → 触发格子效果
 * 3. 进入下一位玩家
 * 4. 所有玩家行动完毕 → 进入下一大轮
 * 5. 检查是否触发比武
 */
class TurnManager {
  /**
   * @param {Object} options
   * @param {string[]} options.order — 玩家ID列表，按跑圈顺序排列
   */
  constructor ({ order = [] } = {}) {
    /**
     * @type {string[]}
     * @description 玩家ID列表，按跑圈顺序排列
     */
    this.order = [...order]

    /** @type {number} 当前玩家在order中的索引 */
    this.currentIndex = 0

    /** @type {number} 当前大轮数（所有人完成一次算一轮） */
    this.round = 1

    /**
     * @type {string}
     * @description 当前阶段名
     * 'run' — 跑圈阶段
     * 'combat' — 比武阶段
     * 'settlement' — 结算阶段
     */
    this.phase = 'run'

    /**
     * @type {number}
     * @description 当前轮已行动玩家计数
     */
    this.actedThisRound = 0
  }

  /**
   * @method init
   * @param {string[]} order — 玩家ID顺序
   * @description 初始化回合顺序（通常在开局投骰定序后调用）
   */
  init (order) {
    this.order = [...order]
    this.currentIndex = 0
    this.round = 1
    this.phase = 'run'
    this.actedThisRound = 0
  }

  /**
   * @method nextTurn
   * @param {Function} [shouldSkipFn] — (playerId) => boolean 判断玩家是否应跳过的函数
   * @returns {{ playerId: string, skipped: boolean, newRound: boolean }}
   * @description 进入下一位玩家的回合。
   * 自动检测是否完成一轮，若完成则递增轮数。
   * shouldSkipFn: 外部传入的检查函数（查询EffectManager的skip_turn效果）
   */
  nextTurn (shouldSkipFn) {
    // 先移到下一个索引
    this.currentIndex = (this.currentIndex + 1) % this.order.length

    // 检查下一个玩家是否需要跳过
    let skipped = false
    if (typeof shouldSkipFn === 'function') {
      if (shouldSkipFn(this.order[this.currentIndex])) {
        skipped = true
        // 跳过时再前进到下一个
        this.currentIndex = (this.currentIndex + 1) % this.order.length
      }
    }

    this.actedThisRound++

    // 检测是否完成一轮：当回到索引0且已行动数>=玩家数时
    let newRound = false
    if (this.currentIndex === 0 && this.actedThisRound >= this.order.length) {
      this.round++
      this.actedThisRound = 0
      newRound = true
    }

    return {
      playerId: this.order[this.currentIndex],
      skipped,
      newRound
    }
  }

  /**
   * @method getCurrentPlayer
   * @returns {string} — 当前轮到操作的玩家ID
   */
  getCurrentPlayer () {
    return this.order[this.currentIndex]
  }

  /**
   * @method isRoundComplete
   * @param {number} playerCount — 存活玩家数量
   * @returns {boolean}
   * @description 是否本轮所有人都行动完了
   */
  isRoundComplete (playerCount) {
    return this.actedThisRound >= playerCount
  }

  /**
   * @method advanceRound
   * @description 进入下一大轮。重置计数，递增轮数。
   */
  advanceRound () {
    this.round++
    this.actedThisRound = 0
    this.currentIndex = 0
  }

  /**
   * @method setPhase
   * @param {string} name — 阶段名 'run' | 'combat' | 'settlement'
   */
  setPhase (name) {
    this.phase = name
  }

  /**
   * @method toJSON
   * @returns {Object} — TurnManager状态快照
   */
  toJSON () {
    return {
      order: [...this.order],
      currentIndex: this.currentIndex,
      round: this.round,
      phase: this.phase,
      actedThisRound: this.actedThisRound
    }
  }
}

export { TurnManager }
