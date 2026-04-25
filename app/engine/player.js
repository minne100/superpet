/**
 * @class Player
 * @description 单个玩家的全部状态。每个GameEngine实例管理4个Player实例。
 * 包含：宠物/天赋/属性/手牌/位置/比武状态/活跃buff。
 */
class Player {
  /**
   * @param {Object} options
   * @param {string} options.id — 玩家唯一标识（如 "A", "B"）
   * @param {string} [options.name=''] — 宠物名称
   * @param {string|null} [options.talent=null] — 天赋名（如开启）
   */
  constructor ({
    id,
    name = '',
    talent = null
  } = {}) {
    // === 基础信息 ===
    /** @type {string} 玩家唯一标识 */
    this.id = id
    /** @type {string} 宠物名称（猫/狗/兔/鹦鹉） */
    this.name = name
    /** @type {string|null} 天赋名，未开启时为null */
    this.talent = talent

    // === 跑圈属性 ===
    /** @type {number} 金币（初始5） */
    this.gold = 5
    /** @type {number} 基础攻击力（初始1，跑圈修炼累加） */
    this.attack = 1
    /** @type {number} 基础防御力（初始1，跑圈修炼累加） */
    this.defense = 1
    /**
     * @type {number[]|null} 棋盘坐标 [row, col]（田字格，初始null，由开局选择决定）
     * 规则书 §3.1：开始时玩家选择任意一个空的休整格作为出发点
     */
    this.position = null

    /**
     * @type {number[]|null} 上一步来路坐标（用于普通格排除掉头）
     * 开局第一步为 null，表示从起点出发无来路限制
     */
    this.prevPosition = null

    // === 比武属性 ===
    /** @type {boolean} 是否在比武中 */
    this.inCombat = false
    /**
     * @type {{x:number, y:number, dir:string}|null}
     * @description 比武对战盘上的坐标和方向
     * dir: 'N'|'NE'|'SE'|'S'|'SW'|'NW' 六边形方向
     */
    this.combatPos = null
    // 临战属性（比武专属，比武结束时归零）
    /** @type {number} 临时加攻（比武专用） */
    this.combatAtkBuff = 0
    /** @type {number} 临时加防（比武专用） */
    this.combatDefBuff = 0

    // === 手牌 ===
    this.hand = {
      move: [],        // 招式卡
      neigong: [],     // 内功卡
      opportunity: [], // 机遇卡（抽到但暂未执行的）
      event: [],       // 事件卡
      battle: []       // 比武卡（比武格触发时抽取/购买）
    }

    /**
     * @type {Object[]} 天赋卡（开局选宠物时发放，每局只能用一次）
     * 规则书 §3.3.6：每只宠物固定2张天赋卡，作用与同名比武卡相同。
     * 结构：[{ cardId, name, used: false }, ...]
     */
    this.talentCards = []

    // === 状态标记 ===
    /** @type {boolean} 是否存活（杀戮局可能被淘汰） */
    this.alive = true
    /** @type {boolean} 是否下一轮轮空 */
    this.skipNextTurn = false
  }

  // ============ 手牌操作 ============

  /**
   * @method addCard
   * @param {string} type — 卡牌类型 'move' | 'neigong'
   * @param {Object} card — 卡牌对象
   * @description 将一张卡加入手牌
   */
  addCard (type, card) {
    if (!this.hand[type]) {
      throw new Error(`未知卡牌类型: ${type}`)
    }
    this.hand[type].push(card)
  }

  /**
   * @method removeCard
   * @param {string} type — 卡牌类型 'move' | 'neigong'
   * @param {number|string} cardIdOrIndex — 卡牌ID或在手牌中的索引
   * @returns {Object|null} — 移除的卡牌，未找到返回null
   * @description 从手牌移除一张卡
   */
  removeCard (type, cardIdOrIndex) {
    if (!this.hand[type]) {
      throw new Error(`未知卡牌类型: ${type}`)
    }
    const cards = this.hand[type]
    let index = -1
    if (typeof cardIdOrIndex === 'number') {
      index = cardIdOrIndex
    } else {
      index = cards.findIndex(c => c.cardId === cardIdOrIndex)
    }
    if (index < 0 || index >= cards.length) return null
    return cards.splice(index, 1)[0]
  }

  /**
   * @method countCards
   * @param {string} [type] — 可选，限定卡牌类型
   * @returns {number} — 手牌总数
   * @description 获取手牌数量
   */
  countCards (type) {
    if (type) {
      return (this.hand[type] || []).length
    }
    return this.hand.move.length + this.hand.neigong.length
  }

  /**
   * @method hasCardType
   * @param {string} type — 卡牌类型
   * @returns {boolean}
   * @description 判断手牌中是否有指定类型的卡
   */
  hasCardType (type) {
    return this.hand[type] && this.hand[type].length > 0
  }

  // ============ 属性操作 ============

  /**
   * @method addGold
   * @param {number} amount — 增加量
   * @description 增加金币
   */
  addGold (amount) {
    this.gold += amount
  }

  /**
   * @method removeGold
   * @param {number} amount — 减少量
   * @returns {number} — 实际扣除的金币（不足则全扣完）
   * @description 扣除金币，不会导致负数
   */
  removeGold (amount) {
    const actual = Math.min(this.gold, amount)
    this.gold -= actual
    return actual
  }

  /**
   * @method modifyAttack
   * @param {number} delta — 变化量（正数增加，负数减少）
   * @description 修改基础攻击力
   */
  modifyAttack (delta) {
    this.attack = Math.max(0, this.attack + delta)
  }

  /**
   * @method modifyDefense
   * @param {number} delta — 变化量
   * @description 修改基础防御力
   */
  modifyDefense (delta) {
    this.defense = Math.max(0, this.defense + delta)
  }

  // ============ 比武操作 ============

  /**
   * @method getCombatAttack
   * @returns {number} — 比武时的总攻击力
   * @description 计算比武时的总攻击 = 基础攻击 + 临战加攻
   */
  getCombatAttack () {
    return this.attack + this.combatAtkBuff
  }

  /**
   * @method getCombatDefense
   * @returns {number} — 比武时的总防御力
   * @description 计算比武时的总防御 = 基础防御 + 临战加防
   */
  getCombatDefense () {
    return this.defense + this.combatDefBuff
  }

  // ============ 序列化 ============

  /**
   * @method toJSON
   * @returns {Object} — 玩家状态纯数据快照
   * @description 用于状态同步和序列化（剔除可能的循环引用）
   */
  toJSON () {
    return {
      id: this.id,
      name: this.name,
      talent: this.talent,
      gold: this.gold,
      attack: this.attack,
      defense: this.defense,
      position: this.position,
      prevPosition: this.prevPosition,
      inCombat: this.inCombat,
      combatPos: this.combatPos,
      combatAtkBuff: this.combatAtkBuff,
      combatDefBuff: this.combatDefBuff,
      hand: {
        move: [...this.hand.move],
        neigong: [...this.hand.neigong],
        battle: [...this.hand.battle]
      },
      talentCards: this.talentCards.map(c => ({ ...c })),
      alive: this.alive,
      skipNextTurn: this.skipNextTurn
    }
  }
}

export { Player }
