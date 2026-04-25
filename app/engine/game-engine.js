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
import { createDeck, shuffle } from './load-cards.js'

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
   * @description 初始化游戏：创建玩家、洗牌。
   * 注意：此时尚未确定跑圈顺序，也未分配宠物和起点。
   * 正式流程：init() → rollForOrder() → assignPets() → assignStartPos() → 开始跑圈
   */
  init () {
    const { playerIds } = this.config

    // 创建玩家（ID为A/B/C/D，宠物在开局阶段选择）
    this.players = playerIds.map(id => new Player({ id }))

    // 洗牌所有牌堆
    this.decks.move = createDeck('move', this.#nextSeed())
    this.decks.neigong = createDeck('neigong', this.#nextSeed())
    this.decks.opportunity = createDeck('opportunity', this.#nextSeed())
    this.decks.event = createDeck('event', this.#nextSeed())
    this.decks.battle = []

    this.phase = 'setup'  // 开局阶段，还未开始跑圈

    return this.getState()
  }

  /**
   * @method rollForOrder
   * @description 规则书 §3.1：所有玩家投骰子，按点数从大到小决定跑圈顺序。
   * 点数相同者继续投，直到分出高下。
   * @returns {{ rolls: Object[], order: string[] }}
   *   rolls: 每轮每人的投骰结果 [{round, playerId, value}]
   *   order: 最终跑圈顺序（从先到后的玩家ID列表）
   */
  rollForOrder () {
    const playerIds = this.players.map(p => p.id)
    const allRolls = []

    /**
     * 递归排序：对 candidates 投骰，按点数从高到低排名次。
     * 相同点数的玩家递归重投，直到完全分出先后。
     * 返回按名次排好的玩家ID数组。
     */
    const sortGroup = (candidates, round) => {
      if (candidates.length === 1) return candidates

      // 投骰
      const rolls = candidates.map(id => {
        const value = this.#rollDice()
        allRolls.push({ round, playerId: id, value })
        return { playerId: id, value }
      })

      // 按点数从高到低分组
      const groups = new Map()
      for (const r of rolls) {
        if (!groups.has(r.value)) groups.set(r.value, [])
        groups.get(r.value).push(r.playerId)
      }

      // 从高到低处理每组：唯一点数直接确定，平局递归重投
      const sorted = [...groups.keys()].sort((a, b) => b - a)
      const result = []
      for (const val of sorted) {
        const group = groups.get(val)
        if (group.length === 1) {
          result.push(group[0])
        } else {
          // 平局：递归重投这一组，结果依次排在当前位置
          result.push(...sortGroup(group, round + 1))
        }
      }
      return result
    }

    const finalOrder = sortGroup(playerIds, 1)
    this.turnManager.init(finalOrder)
    return { rolls: allRolls, order: finalOrder }
  }

  /**
   * 天赋卡定义（规则书 §3.3.6）
   * 每只宠物固定2张天赋卡，每局只能用一次，作用与同名比武卡相同。
   */
  static TALENT_CARDS = {
    '猫':  [
      { cardId: 'talent_cat_1', name: '单人位置卡', effect: 'position_single' },
      { cardId: 'talent_cat_2', name: '闪避卡',     effect: 'dodge' }
    ],
    '狗':  [
      { cardId: 'talent_dog_1', name: '单人位置卡', effect: 'position_single' },
      { cardId: 'talent_dog_2', name: '反弹卡',     effect: 'reflect' }
    ],
    '兔子': [
      { cardId: 'talent_rabbit_1', name: '腾挪卡', effect: 'dash' },
      { cardId: 'talent_rabbit_2', name: '闪避卡', effect: 'dodge' }
    ],
    '鹦鹉': [
      { cardId: 'talent_parrot_1', name: '腾挪卡', effect: 'dash' },
      { cardId: 'talent_parrot_2', name: '反弹卡', effect: 'reflect' }
    ]
  }

  /**
   * @method assignPets
   * @description 规则书 §3.1：按跑圈顺序依次选择宠物，并立即发放2张天赋卡。
   * 模拟器中按顺序自动分配，在线版由玩家点击选择。
   * @param {string[]} petOrder — 按跑圈顺序对应的宠物名列表
   *   e.g. ['猫', '狗', '兔子', '鹦鹉']
   * @returns {Object[]} 每位玩家的天赋卡发放记录
   *   [{ playerId, pet, talentCards: [{cardId, name, effect}] }]
   */
  assignPets (petOrder) {
    const order = this.turnManager.order
    const assignments = []

    order.forEach((playerId, i) => {
      const player = this.getPlayer(playerId)
      if (!player) return

      const pet = petOrder[i] || playerId
      player.name = pet

      // 发放天赋卡（必须项，每局游戏均需发放）
      const talents = (GameEngine.TALENT_CARDS[pet] || []).map(t => ({
        ...t,
        used: false  // 标记是否已使用，每局只能用一次
      }))
      player.talentCards = talents

      assignments.push({ playerId, pet, talentCards: talents })
    })

    return assignments
  }

  /**
   * @method assignStartPositions
   * @description 规则书 §3.1：按跑圈顺序依次选择空的休整格作为出发点。
   * @param {Object} posMap — { playerId: [row, col] }
   */
  assignStartPositions (posMap) {
    for (const [playerId, pos] of Object.entries(posMap)) {
      const player = this.getPlayer(playerId)
      if (player) {
        player.position = pos
        player.prevPosition = null
      }
    }
    this.phase = 'run'  // 开局完成，进入跑圈阶段
  }

  /**
   * @method reshuffleDeck
   * @param {string} deckType — 'neigong' | 'opportunity' | 'event'
   * @param {number} [seed] — 洗牌种子（由发起者/AI托管提供，保证各节点一致）
   * @returns {{ reshuffled: boolean, count: number, seed: number }}
   * @description 规则书 §3.1（v2.0）：机遇、事件、内功卡用完后，
   * 将弃牌堆重新洗牌，循环使用。招式卡不循环（抽空则触发终极比武）。
   *
   * 洗牌种子来源：
   * - 在线版：由发起者（或掉线时的AI托管）通过网络广播 RESHUFFLE_SEED 消息，
   *   各节点收到后以相同种子重洗，保证牌序一致。
   * - 模拟器：由引擎内部 PRNG 自动生成（Coordinator 通过 GameBus 广播记录）。
   */
  reshuffleDeck (deckType, seed) {
    const discard = this.discardPiles[deckType]
    if (!discard || discard.length === 0) {
      return { reshuffled: false, count: 0, seed: seed ?? 0 }
    }

    const usedSeed = seed ?? this.#nextSeed()
    this.decks[deckType] = shuffle([...discard], usedSeed)
    this.discardPiles[deckType] = []

    return { reshuffled: true, count: this.decks[deckType].length, seed: usedSeed }
  }

  /**
   * @method #drawCard
   * @private
   * @param {string} deckType — 牌堆类型
   * @returns {{ card: Object|null, reshuffled: boolean, reshuffleSeed: number }}
   * @description 从牌堆抽1张卡。若牌堆为空且弃牌堆有牌，先重洗再抽。
   * 招式卡（move）不重洗，抽空返回 null（触发终极比武）。
   */
  #drawCard (deckType) {
    // 招式卡：不循环，抽空返回 null
    if (deckType === 'move') {
      const card = this.decks.move.pop() ?? null
      return { card, reshuffled: false, reshuffleSeed: 0 }
    }

    // 其他牌堆：空时从弃牌堆重洗
    if (this.decks[deckType].length === 0) {
      const result = this.reshuffleDeck(deckType)
      if (!result.reshuffled) {
        // 弃牌堆也是空的，暂时无牌可抽
        return { card: null, reshuffled: false, reshuffleSeed: 0 }
      }
      const card = this.decks[deckType].pop()
      return { card: card ?? null, reshuffled: true, reshuffleSeed: result.seed }
    }

    const card = this.decks[deckType].pop()
    return { card: card ?? null, reshuffled: false, reshuffleSeed: 0 }
  }

  /**
   * @method #dealInitialCards
   * @private
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

    // 田字格前进：返回 { pos, prevPos, passedJunctions }
    // player.prevPosition 记录上一步来路，首次前进为 null
    const { pos: newPos, prevPos: newPrevPos, passedJunctions } = this.board.advance(
      player.position, steps, player.prevPosition ?? null, choices
    )
    player.prevPosition = newPrevPos
    player.position = newPos

    // 规则书 §3.2：每移动一格获得1金币
    player.addGold(steps)

    // 修炼选项（仅当落在修炼格时有效）
    // cultivateStat: 'attack' | 'defense'（不用内功卡时，选择加攻还是加防）
    // neigongCardId: 选择使用的内功卡ID，null表示不用内功卡
    const cultivateOpts = {
      cultivateStat: action.data?.cultivateStat ?? 'attack',
      neigongCardId: action.data?.neigongCardId ?? null
    }

    // 触发终点格的格子效果
    const cellEvents = this.#triggerCellEffect(player, oldPos, newPos, cultivateOpts)

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
    * - cultivate(修炼): 攻击+1 或 防御+1（二选一）；若使用内功卡，则按卡牌数值加攻或加防，替代基础+1
   * - move(招式): 抽1张招式卡
   * - neigong(内功): 抽1张内功卡
   * - opportunity(机遇): 抽1张机遇卡并执行
   * - event(事件): 抽1张事件卡并执行
   * - battle(比武): 触发比武阶段（由上层游戏逻辑控制）
   */
  #triggerCellEffect (player, oldPos, newPos, cultivateOpts = {}) {
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
        // 修炼格（规则书 §3.2 v1.1）：
        // - 不用内功卡：攻击+1 或 防御+1，二选一（由 action.data.cultivateStat 决定）
        // - 用内功卡：按卡牌的 stat/value 加攻或加防，完全替代基础+1（不叠加）
        // cultivateStat 默认 'attack'，AI 在 PlayerAgent._decideCultivateStat() 中决定

        const cultivateStat = cultivateOpts.cultivateStat ?? 'attack'
        let neigongUsed = null
        let statGained = cultivateStat  // 'attack' | 'defense'
        let valueGained = 1             // 基础值

        // 检查玩家是否选择使用内功卡
        const useNeigong = cultivateOpts.neigongCardId ?? null
        if (useNeigong && player.hand.neigong?.length > 0) {
          const neigongCard = player.hand.neigong.find(c => c.cardId === useNeigong)
          if (neigongCard) {
            // 内功卡自带方向（stat）和数值（value），完全替代基础+1
            const step = neigongCard.steps?.[0]
            if (step) {
              statGained = step.stat   // 'attack' 或 'defense'
              valueGained = step.value // 内功卡数值（1/2/3）
            }
            neigongUsed = neigongCard.cardId
            player.removeCard('neigong', neigongCard.cardId)
            this.discardPiles.neigong.push(neigongCard)
          }
        }

        // 应用修炼加成
        if (statGained === 'attack') {
          player.modifyAttack(valueGained)
        } else {
          player.modifyDefense(valueGained)
        }

        events.push({
          type: 'cultivate',
          stat: statGained,
          value: valueGained,
          neigongUsed
        })
        break
      }

      case 'move': {
        // 招式格：抽1张招式卡（招式卡不循环，抽空触发终极比武）
        const { card } = this.#drawCard('move')
        if (card) {
          player.addCard('move', card)
          events.push({ type: 'draw_move', cardId: card.cardId })
        }
        break
      }

      case 'neigong': {
        // 内功格：抽1张内功卡（v2.0：用完后弃牌堆重洗循环使用）
        const { card, reshuffled, reshuffleSeed } = this.#drawCard('neigong')
        if (reshuffled) {
          events.push({ type: 'reshuffle', deckType: 'neigong', seed: reshuffleSeed })
        }
        if (card) {
          player.addCard('neigong', card)
          events.push({ type: 'draw_neigong', cardId: card.cardId })
        }
        break
      }

      case 'opportunity': {
        // 机遇格：抽1张机遇卡并立即执行（v2.0：用完后弃牌堆重洗循环使用）
        const { card, reshuffled, reshuffleSeed } = this.#drawCard('opportunity')
        if (reshuffled) {
          events.push({ type: 'reshuffle', deckType: 'opportunity', seed: reshuffleSeed })
        }
        if (card) {
          const result = this.cardInterpreter.interpret(card, {
            triggerPlayerId: player.id,
            engine: this
          })
          // 执行后入弃牌堆
          this.discardPiles.opportunity.push(card)
          events.push({ 
            type: 'opportunity_executed', 
            cardId: card.cardId, 
            description: card.description || '',
            result 
          })
        }
        break
      }

      case 'event': {
        // 事件格：抽1张事件卡并立即执行（v2.0：用完后弃牌堆重洗循环使用）
        const { card, reshuffled, reshuffleSeed } = this.#drawCard('event')
        if (reshuffled) {
          events.push({ type: 'reshuffle', deckType: 'event', seed: reshuffleSeed })
        }
        if (card) {
          const result = this.cardInterpreter.interpret(card, {
            triggerPlayerId: player.id,
            engine: this
          })
          // 执行后入弃牌堆
          this.discardPiles.event.push(card)
          events.push({ 
            type: 'event_executed', 
            cardId: card.cardId, 
            description: card.description || '',
            result 
          })
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
    const shouldSkip = (pid) => {
      const hasSkipTurn = this.effectManager.get(pid, 'skip_turn')
      if (hasSkipTurn) {
        this.effectManager.clear(pid, 'skip_turn')
      }
      return hasSkipTurn
    }
    const result = this.turnManager.nextTurn(shouldSkip)
    for (const [pid, effects] of this.effectManager.registry.entries()) {
      for (let i = effects.length - 1; i >= 0; i--) {
        if (effects[i].name !== 'skip_turn' && effects[i].rounds > 0) {
          effects[i].rounds--
        }
        if (effects[i].rounds === 0) {
          effects.splice(i, 1)
        }
      }
    }
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
