/**
 * @class CombatSystem
 * @description 完整比武系统（Phase 1 F-01实现）
 *
 * 功能覆盖：
 * - 比武准备：投骰定顺序、设初始位置方向、复制临战属性
 * - 37格六边形对战盘（BattleBoard驱动）
 * - 商店阶段：购买位置卡/连击卡/腾挪卡（6种比武卡）
 * - 攻击阶段：招式卡范围判定、闪避卡/反弹卡处理
 * - 移动阶段：相邻六格移动、可改变方向
 * - 缩圈机制：每5轮移除一层
 * - 比武结算：胜者得全部金币 / 同归于尽无转移
 */

import { BattleBoard, DIR_NAMES, DIRS } from './battle-board.js'

class CombatSystem {
  /**
   * @param {Object} options
   * @param {Object} [options.engine=null] — GameEngine引用
   */
  constructor ({ engine = null } = {}) {
    this.engine = engine
    this.board = new BattleBoard()
    this.reset()
  }

  /**
   * 重置比武系统（每次比武前调用）
   */
  reset () {
    /** @type {Object<string, Object>} 玩家比武状态 */
    this.battleState = null

    /** @type {Array} 出手顺序列表 */
    this.order = []

    /** @type {number} 当前出手索引 */
    this.currentIdx = 0

    /** @type {number} 当前比武轮数（用于缩圈） */
    this.round = 0

    /** @type {boolean} 比武是否结束 */
    this.isOver = false

    /** @type {string|null} 胜利者 */
    this.victorId = null

    /** @type {boolean} 是否同归于尽 */
    this.allDead = false

    /** @type {Object<string, number>} 比武开始前各玩家金币快照（用于同归于尽返还） */
    this.goldSnapshot = {}

    /** @type {Object} 当前正在处理的行动上下文 */
    this.actionContext = null
  }

  /**
   * @method startBattle
   * @param {string[]} playerIds — 参与比武的玩家ID列表
   * @param {Object} options — { engine, players: { id: playerObj } }
   * @returns {Object} — { order: string[], battleState: Object }
   * @description 开始比武阶段
   */
  startBattle (playerIds, { engine, players } = {}) {
    this.reset()

    if (engine) this.engine = engine
    this.board.round = 0

    // 记录金币快照（同归于尽时返还）
    if (engine) {
      for (const pid of playerIds) {
        const p = engine.getPlayer(pid)
        if (p) this.goldSnapshot[pid] = p.gold
      }
    }

    /** 出手顺序（简化：按骰子点数） */
    // 实际游戏中要投骰子决定，这里简化处理——随机排序
    const shuffled = [...playerIds]
    for (let i = shuffled.length - 1; i > 0; i--) {
      let rng = engine ? engine.prng?.next?.() ?? Math.random() : Math.random()
      const j = Math.floor(rng * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    this.order = shuffled
    this.currentIdx = 0

    // 初始化每个玩家的比武状态
    this.battleState = {}
    for (const pid of playerIds) {
      const player = engine ? engine.getPlayer(pid) : null
      const permAttack = player ? player.attack : 1
      const permDefense = player ? player.defense : 1

      // 初始位置：自动分配（PvE模式）或随机
      const pos = this.#getStartPosition(pid)

      this.battleState[pid] = {
        id: pid,
        // 临战属性（永久属性的副本）
        tempAttack: permAttack,
        tempDefense: permDefense,
        // 位置
        pos,
        // 朝向（默认N）
        direction: 'N',
        // 存活
        alive: true,
        // 商店卡（在比武中购买的）
        cards: {
          position_single: 0,  // 单人位置卡
          position_all: 0,    // 全体位置卡
          combo: 0,           // 连击卡
          teleport: 0,        // 腾挪卡
          dodge: 0,           // 闪避卡
          reflect: 0          // 反弹卡
        },
        // 天赋卡（进阶规则）
        talentCards: []
      }
    }

    return {
      order: this.order,
      battleState: this.battleState
    }
  }

  /**
   * @method getStartPosition
   * @private
   * @param {string} pid — 玩家ID
   * @returns {number} — 格子ID
   */
  #getStartPosition (pid) {
    // 默认放在不同区域，方便测试
    const positions = [0, 5, 14, 27]
    const idx = this.order.indexOf(pid)
    return positions[Math.min(idx, positions.length - 1)]
  }

  /**
   * @method getCurrentPlayer
   * @returns {string|null} 当前出手玩家ID
   */
  getCurrentPlayer () {
    if (!this.order || this.currentIdx >= this.order.length) return null
    const pid = this.order[this.currentIdx]
    const state = this.battleState[pid]
    if (!state || !state.alive) return this.#nextAlive()
    return pid
  }

  /**
   * @method #nextAlive
   * @private
   * @returns {string|null}
   */
  #nextAlive () {
    while (this.currentIdx < this.order.length) {
      const pid = this.order[this.currentIdx]
      const state = this.battleState[pid]
      if (state && state.alive) return pid
      this.currentIdx++
    }
    return null
  }

  /**
   * @method handleAction
   * @param {Object} action — { type: string, playerId: string, data: Object }
   * @returns {Object} — 行动结果
   * @description 处理比武中的各种行动
   */
  handleAction (action) {
    if (this.isOver) return { error: 'battle_already_over' }

    const pid = action.playerId
    const state = this.battleState[pid]
    if (!state || !state.alive) return { error: 'player_not_in_battle_or_dead' }

    this.actionContext = { pid, state }

    switch (action.type) {
      case 'ATTACK':
        return this.#handleAttack(action)
      case 'MOVE':
        return this.#handleMove(action)
      case 'BUY_CARD':
        return this.#handleBuyCard(action)
      case 'USE_CARD':
        return this.#handleUseCard(action)
      case 'CHANGE_DIRECTION':
        return this.#handleChangeDirection(action)
      case 'SURRENDER':
        return this.#handleSurrender(action)
      default:
        return this.#handleAttack(action)
    }
  }

  /**
   * @method #handleAttack
   * @private
   * @param {Object} action — { data: { cardId?: string, moveCard?: Object } }
   * @returns {Object} — 攻击结果
   */
  #handleAttack (action) {
    const pid = action.playerId
    const state = this.battleState[pid]
    const engine = this.engine

    // 检查是否有连击卡（连击卡允许一次使用多张招式）
    const comboCount = state.cards.combo || 0

    // 如果没有招式卡，只能攻击自己所在格（攻击力=临战攻击-自身临战防御=自伤=无效，跳过的）
    const hasMove = engine ? (
      engine.players.find(p => p.id === pid)?.hand?.move?.length > 0
    ) : false

    if (!hasMove && comboCount === 0) {
      // 无招式卡也无连击卡 → 攻击自己位置（无效操作，但规则如此）
      return {
        type: 'ATTACK',
        pid,
        hits: [],
        message: '无可用招式卡，攻击自身位置（无效果）',
        damageDealt: 0
      }
    }

    // 使用招式卡（有卡时默认使用一张）
    let usedCard = null

    // 使用招式卡攻击
    const moveCard = action.data?.moveCard || this.#pickMoveCard(pid)
    if (!moveCard) {
      // 没招式卡也没连击卡，输出0伤害
      return {
        type: 'ATTACK',
        pid,
        hits: [],
        message: '无招式卡可用',
        damageDealt: 0
      }
    }

    usedCard = moveCard

    // 遍历所有存活玩家，判断是否在招式范围内
    const hits = []
    for (const [targetPid, targetState] of Object.entries(this.battleState)) {
      if (targetPid === pid || !targetState.alive) continue

      const inRange = this.board.isInRange(
        state.pos,
        state.direction,
        moveCard,
        targetState.pos
      )

      if (!inRange) continue

      // 检查目标是否有闪避卡
      if (targetState.cards.dodge > 0) {
        targetState.cards.dodge--
        hits.push({
          targetPid,
          dodged: true,
          damage: 0,
          originalPos: targetState.pos,
          message: `${targetPid}使用闪避卡，躲过攻击`
        })
        continue
      }

      // 计算伤害
      const rawDamage = state.tempAttack
      const effectiveDefense = targetState.tempDefense
      const netDamage = Math.max(0, rawDamage - effectiveDefense)

      if (netDamage > 0) {
        targetState.tempDefense = 0
        targetState.alive = false
      } else {
        targetState.tempDefense -= rawDamage
      }

      // 检查目标是否有反弹卡
      let reflectDamage = 0
      if (targetState.cards.reflect > 0) {
        targetState.cards.reflect--
        reflectDamage = Math.floor(state.tempAttack / 2)
        // 反弹伤害直接扣除攻击者防御
        state.tempDefense -= reflectDamage
        if (state.tempDefense <= 0) {
          state.alive = false
        }
      }

      hits.push({
        targetPid,
        dodged: false,
        damage: netDamage,
        reflectDamage,
        originalPos: targetState.pos,
        survivor: state.alive,
        message: targetState.alive ? `${targetPid}被击中，临战防御-${rawDamage}` : `${targetPid}被击败`
      })
    }

    // 消耗招式卡
    if (usedCard && engine) {
      const player = engine.players.find(p => p.id === pid)
      if (player && player.hand.move && player.hand.move.length > 0) {
        const idx = player.hand.move.findIndex(c => c.cardId === usedCard.cardId)
        if (idx !== -1) {
          player.hand.move.splice(idx, 1)
        }
      }
    }

    // 如果连击卡>0，消耗一张连击卡（可以继续攻击，但当前回合只处理一次）
    // 连击卡效果：本回合可打出多张招式卡，但这里简化——仅标记使用

    // 检查是否只剩一个存活
    this.#checkBattleEnd()

    return {
      type: 'ATTACK',
      pid,
      usedCard: usedCard?.cardId || null,
      hits,
      direction: state.direction
    }
  }

  /**
   * @method #pickMoveCard
   * @private
   * @param {string} pid
   * @returns {Object|null}
   */
  #pickMoveCard (pid) {
    const engine = this.engine
    if (!engine) return null
    const player = engine.players.find(p => p.id === pid)
    if (!player || !player.hand.move || player.hand.move.length === 0) return null
    // 默认使用第一张
    return player.hand.move[0]
  }

  /**
   * @method #handleMove
   * @private
   * @param {Object} action — { data: { to?: number, direction?: string } }
   * @returns {Object}
   */
  #handleMove (action) {
    const pid = action.playerId
    const state = this.battleState[pid]

    // 如果已经缩到1格，跳过移动
    if (this.board.getActiveCellCount() === 1) {
      return { type: 'MOVE', pid, moved: false, message: '场地仅1格，无法移动' }
    }

    let targetPos = action.data?.to
    const direction = action.data?.direction

    if (targetPos !== undefined) {
      // 检查是否相邻
      if (!this.board.isAdjacent(state.pos, targetPos)) {
        return { type: 'MOVE', pid, moved: false, message: '目标格不相邻' }
      }

      // 检查目标格是否已被占据
      for (const [otherPid, otherState] of Object.entries(this.battleState)) {
        if (otherPid !== pid && otherState.alive && otherState.pos === targetPos) {
          targetPos = this.#findAdjacentFree(pid, targetPos)
          break
        }
      }
    } else if (direction) {
      const neighbor = this.board.getNeighbor(state.pos, direction)
      if (neighbor === -1) {
        return { type: 'MOVE', pid, moved: false, message: '该方向无相邻格子' }
      }
      targetPos = neighbor

      // 检查被占据
      for (const [otherPid, otherState] of Object.entries(this.battleState)) {
        if (otherPid !== pid && otherState.alive && otherState.pos === targetPos) {
          targetPos = this.#findAdjacentFree(pid, state.pos)
          break
        }
      }
    } else {
      // 无指定目标：自动移动到随机相邻格
      const adjacents = this.board.getAdjacent(state.pos)
      const free = adjacents.filter(pos => {
        return !Object.values(this.battleState).some(s => s.alive && s.pos === pos)
      })
      if (free.length === 0) {
        // 没有空位，保持不动
        return { type: 'MOVE', pid, moved: false, message: '所有相邻格都被占据' }
      }
      targetPos = free[Math.floor(this.board.board.round % free.length)]
    }

    const oldPos = state.pos
    state.pos = targetPos

    return {
      type: 'MOVE',
      pid,
      moved: true,
      from: oldPos,
      to: targetPos
    }
  }

  /**
   * @method #findAdjacentFree
   * @private
   * @param {string} pid — 当前玩家
   * @param {number} preferred
   * @returns {number}
   */
  #findAdjacentFree (pid, preferred) {
    const adjacents = this.board.getAdjacent(preferred)
    const free = adjacents.filter(pos => {
      return !Object.values(this.battleState).some(s => s.alive && s.pos === pos)
    })
    if (free.length > 0) return free[0]
    return preferred
  }

  /**
   * @method #handleBuyCard
   * @private
   * @param {Object} action — { data: { cardType: string, cost: number } }
   * @returns {Object}
   */
  #handleBuyCard (action) {
    const pid = action.playerId
    const state = this.battleState[pid]
    const cardType = action.data?.cardType
    const cost = action.data?.cost || 3
    const engine = this.engine

    if (!cardType) return { type: 'BUY_CARD', pid, success: false, message: '未指定卡牌类型' }

    const validTypes = ['position_single', 'position_all', 'combo', 'teleport', 'dodge', 'reflect']
    if (!validTypes.includes(cardType)) {
      return { type: 'BUY_CARD', pid, success: false, message: '无效的卡牌类型' }
    }

    // 已持有同名卡不可购买
    if (state.cards[cardType] > 0) {
      return { type: 'BUY_CARD', pid, success: false, message: '已持有同名卡' }
    }

    // 检查金币
    const player = engine ? engine.getPlayer(pid) : null
    if (player && player.gold < cost) {
      return { type: 'BUY_CARD', pid, success: false, message: '金币不足' }
    }

    // 扣金 + 加卡
    if (player) player.removeGold(cost)
    state.cards[cardType]++

    return {
      type: 'BUY_CARD',
      pid,
      success: true,
      cardType,
      cost
    }
  }

  /**
   * @method #handleUseCard
   * @private
   * @param {Object} action — { data: { cardType: string, ... } }
   * @returns {Object}
   */
  #handleUseCard (action) {
    const pid = action.playerId
    const state = this.battleState[pid]
    const cardType = action.data?.cardType

    if (!cardType || !state.cards[cardType] || state.cards[cardType] <= 0) {
      return { type: 'USE_CARD', pid, success: false, message: '未持有该卡' }
    }

    state.cards[cardType]--

    switch (cardType) {
      case 'position_single': {
        // 单人位置卡：查看一个对手的位置
        const target = action.data?.target
        const ts = this.battleState[target]
        if (!ts) return { type: 'USE_CARD', pid, success: false, message: '无效目标' }
        return {
          type: 'USE_CARD',
          pid,
          success: true,
          cardType,
          revealed: { target, position: ts.pos, direction: ts.direction }
        }
      }

      case 'position_all': {
        // 全体位置卡：查看所有对手的位置
        const allPositions = {}
        for (const [otherPid, otherState] of Object.entries(this.battleState)) {
          if (otherPid !== pid && otherState.alive) {
            allPositions[otherPid] = { position: otherState.pos, direction: otherState.direction }
          }
        }
        return {
          type: 'USE_CARD',
          pid,
          success: true,
          cardType,
          revealed: allPositions
        }
      }

      case 'combo': {
        // 连击卡：标记本回合可出多张招式（在此不做具体处理，由调用方控制）
        return {
          type: 'USE_CARD',
          pid,
          success: true,
          cardType,
          message: '激活连击，本回合可打出多张招式卡'
        }
      }

      case 'teleport': {
        // 腾挪卡：移动2格并改变方向
        const dir = action.data?.direction
        const steps = 2
        let newPos = state.pos
        if (dir) {
          newPos = this.board.getCellInDirection(state.pos, dir, steps)
        } else {
          // 方向未指定，随机选择
          const dirs = this.board.getDirections()
          for (const d of dirs) {
            const np = this.board.getNeighbor(state.pos, d)
            if (np !== -1) {
              newPos = np
              break
            }
          }
        }

        if (newPos === -1 || newPos === state.pos) {
          return { type: 'USE_CARD', pid, success: false, message: '无法移动2格' }
        }

        const oldPos = state.pos
        state.pos = newPos
        if (action.data?.newDirection) {
          state.direction = action.data.newDirection
        }

        return {
          type: 'USE_CARD',
          pid,
          success: true,
          cardType,
          from: oldPos,
          to: newPos,
          direction: state.direction
        }
      }

      case 'dodge':
        // 闪避卡效果在攻击时被动触发，这里只是使用一张作为预激活
        return { type: 'USE_CARD', pid, success: true, cardType, message: '获得一次闪避机会' }

      case 'reflect':
        return { type: 'USE_CARD', pid, success: true, cardType, message: '获得一次反弹机会' }

      default:
        return { type: 'USE_CARD', pid, success: false, message: '未知卡牌' }
    }
  }

  /**
   * @method #handleChangeDirection
   * @private
   * @param {Object} action — { data: { direction: string } }
   * @returns {Object}
   */
  #handleChangeDirection (action) {
    const pid = action.playerId
    const state = this.battleState[pid]
    const dir = action.data?.direction

    if (!dir || !DIR_NAMES.includes(dir)) {
      return { type: 'CHANGE_DIRECTION', pid, success: false, message: '无效方向' }
    }

    state.direction = dir
    return {
      type: 'CHANGE_DIRECTION',
      pid,
      success: true,
      direction: dir
    }
  }

  /**
   * @method #handleSurrender
   * @private
   * @returns {Object}
   */
  #handleSurrender (action) {
    const pid = action.playerId
    const state = this.battleState[pid]
    state.alive = false
    this.#checkBattleEnd()
    return {
      type: 'SURRENDER',
      pid,
      message: `${pid}投降退出比武`
    }
  }

  /**
   * @method #checkBattleEnd
   * @private
   * @description 检查比武是否结束
   */
  #checkBattleEnd () {
    const alive = Object.entries(this.battleState)
      .filter(([, s]) => s && s.alive)

    if (alive.length <= 1) {
      this.isOver = true
      if (alive.length === 1) {
        this.victorId = alive[0][0]
        // 金币结算（在外部由GameEngine处理）
      } else {
        // 同归于尽
        this.allDead = true
      }
    }
  }

  /**
   * @method addTalentCard
   * @param {string} pid — 玩家ID
   * @param {string} cardType — 卡牌类型
   * @description 增加天赋卡（进阶规则）
   */
  addTalentCard (pid, cardType) {
    const state = this.battleState[pid]
    if (!state) return
    state.cards[cardType] = (state.cards[cardType] || 0) + 1
    state.talentCards.push(cardType)
  }

  /**
   * @method endTurn
   * @description 结束当前玩家的回合，推进到下一个玩家
   * 一轮结束时调用advanceRound进行缩圈检查
   */
  endTurn () {
    if (this.isOver) return

    // 移动到下一个玩家
    this.currentIdx++

    // 检查是否所有存活玩家都完成了一次回合
    if (this.currentIdx >= this.order.length) {
      this.currentIdx = 0
      this.round++
      this.board.advanceRound()

      // 缩圈处理：将被移除格子上的玩家推往中心
      const activeCells = new Set(this.board.getActiveCells())
      for (const [pid, state] of Object.entries(this.battleState)) {
        if (state && state.alive && !activeCells.has(state.pos)) {
          // 玩家站在将被移除的格子上，向中心移动
          const centerDir = this.#getCenterDirection(state.pos)
          let newPos = this.board.getNeighbor(state.pos, centerDir)
          if (newPos === -1) {
            // 如果无法直接向中心移动，找最近的活跃格子
            newPos = this.#findClosestActive(state.pos, activeCells)
          }
          state.pos = newPos !== -1 ? newPos : 0
        }
      }
    }
  }

  /**
   * @method #getCenterDirection
   * @private
   * @param {number} pos — 格子ID
   * @returns {string} — 朝向中心的方向
   */
  #getCenterDirection (pos) {
    // 简化：朝00号格的方向
    if (pos <= 6) return 'NE' // 第1圈
    if (pos <= 18) return 'S' // 第2圈
    return 'SW' // 第3-4圈
  }

  /**
   * @method #findClosestActive
   * @private
   * @param {number} pos
   * @param {Set} activeCells
   * @returns {number}
   */
  #findClosestActive (pos, activeCells) {
    let minDist = Infinity
    let closest = 0
    for (const cellId of activeCells) {
      const dist = Math.abs(pos - cellId)
      if (dist < minDist) {
        minDist = dist
        closest = cellId
      }
    }
    return closest
  }

  /**
   * @method settleBattle
   * @returns {Object} — 结算结果
   * @description 比武结算：金币转移
   * 返回结果让 GameEngine 调用 player.addGold/removeGold
   */
  settleBattle () {
    if (!this.isOver) return { type: 'battle_not_over' }

    if (this.allDead) {
      // 同归于尽：金币不转移（保持比武开始前的值）
      return {
        type: 'SETTLE',
        victor: null,
        allDead: true,
        transfers: []
      }
    }

    if (this.victorId) {
      const engine = this.engine
      const transfers = []

      for (const [pid, state] of Object.entries(this.battleState)) {
        if (pid !== this.victorId) {
          const player = engine ? engine.getPlayer(pid) : null
          if (player && player.gold > 0) {
            transfers.push({
              from: pid,
              to: this.victorId,
              amount: player.gold
            })
          }
        }
      }

      return {
        type: 'SETTLE',
        victor: this.victorId,
        allDead: false,
        transfers
      }
    }

    return { type: 'SETTLE', victor: null, transfers: [] }
  }

  /**
   * @method toJSON
   * @returns {Object}
   */
  toJSON () {
    return {
      order: this.order,
      currentIdx: this.currentIdx,
      round: this.round,
      isOver: this.isOver,
      victorId: this.victorId,
      allDead: this.allDead,
      battleState: this.battleState,
      boardRound: this.board.round
    }
  }

  /**
   * @method checkEndOfBattle
   * @description 检测比武是否结束（外部循环中调用）
   * @returns {Object} — { isOver, victorId, allDead }
   */
  checkEndOfBattle () {
    const alive = []
    for (const [pid, state] of Object.entries(this.battleState)) {
      if (state && state.alive) alive.push(pid)
    }

    if (alive.length <= 1) {
      this.isOver = true
      if (alive.length === 1) {
        this.victorId = alive[0]
      } else {
        this.allDead = true
      }
    }

    return { isOver: this.isOver, victorId: this.victorId, allDead: this.allDead }
  }
}

export { CombatSystem }
