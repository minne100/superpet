/**
 * @class EffectManager
 * @description 管理玩家身上的状态效果（debuff/buff）。
 * 不是回调、不是遍历——游戏引擎的动作函数主动查询此注册表。
 * 效果类型: skip_turn, dice_x2, dice_half, cultivation_x2,
 *            cultivation_skip, extra_draw_move, redraw_once,
 *            rest_cultivate, double_roll, no_draw, next_turn_choose_step
 */
class EffectManager {
  constructor () {
    /**
     * @type {Map<string, Effect[]>}
     * @description 玩家ID → Effect数组
     */
    this.registry = new Map()
  }

  /**
   * @method add
   * @param {string} playerId — 玩家ID
   * @param {string} effectName — 效果名称（如 'skip_turn'）
   * @param {number} rounds — 持续轮次（-1表示永久，直到被清除）
   * @param {Object} [meta={}] — 附加数据（如source卡牌ID）
   * @returns {Effect} — 创建的Effect对象
   * @description 给玩家挂载一个效果。
   * 注意：互斥效果(dice_x2与dice_half)需要在调用前由调用方处理。
   */
  add (playerId, effectName, rounds, meta = {}) {
    if (!this.registry.has(playerId)) {
      this.registry.set(playerId, [])
    }
    const effect = {
      source: meta.source || 'unknown',
      name: effectName,
      rounds,
      meta
    }
    this.registry.get(playerId).push(effect)
    return effect
  }

  /**
   * @method get
   * @param {string} playerId — 玩家ID
   * @param {string} effectName — 效果名称
   * @returns {boolean}
   * @description 判断玩家是否有某效果
   */
  get (playerId, effectName) {
    const effects = this.registry.get(playerId)
    if (!effects || effects.length === 0) return false
    return effects.some(e => e.name === effectName)
  }

  /**
   * @method getFirst
   * @param {string} playerId — 玩家ID
   * @param {string} effectName — 效果名称
   * @returns {Effect|null}
   * @description 获取玩家的某效果（返回第一个匹配项，可用于获取meta）
   */
  getFirst (playerId, effectName) {
    const effects = this.registry.get(playerId)
    if (!effects) return null
    return effects.find(e => e.name === effectName) || null
  }

  /**
   * @method use
   * @param {string} playerId — 玩家ID
   * @param {string} effectName — 效果名称
   * @returns {boolean} — 是否成功消耗
   * @description 消耗某效果一次（立即清除该效果实例）。
   * 适用于redraw_once等一次性效果。
   */
  use (playerId, effectName) {
    const effects = this.registry.get(playerId)
    if (!effects) return false
    const index = effects.findIndex(e => e.name === effectName)
    if (index >= 0) {
      effects.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * @method tick
   * @param {string} playerId — 玩家ID
   * @param {string} effectName — 效果名称
   * @description 某玩家的某效果轮次-1，到期自动清除
   */
  tick (playerId, effectName) {
    const effects = this.registry.get(playerId)
    if (!effects) return
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i].name === effectName) {
        if (effects[i].rounds > 0) {
          effects[i].rounds--
        }
        if (effects[i].rounds === 0) {
          effects.splice(i, 1)
        }
      }
    }
  }

  /**
   * @method tickAll
   * @description 所有玩家所有效果的轮次-1，到期自动清除
   */
  tickAll () {
    for (const [playerId, effects] of this.registry.entries()) {
      for (let i = effects.length - 1; i >= 0; i--) {
        if (effects[i].rounds > 0) {
          effects[i].rounds--
        }
        if (effects[i].rounds === 0) {
          effects.splice(i, 1)
        }
      }
    }
  }

  /**
   * @method clear
   * @param {string} playerId — 玩家ID
   * @param {string} effectName — 效果名称
   * @returns {boolean} — 是否清除了效果
   * @description 主动移除玩家身上的某效果
   */
  clear (playerId, effectName) {
    const effects = this.registry.get(playerId)
    if (!effects) return false
    const before = effects.length
    const remaining = effects.filter(e => e.name !== effectName)
    if (remaining.length === before) return false
    this.registry.set(playerId, remaining)
    return true
  }

  /**
   * @method clearAll
   * @param {string} playerId — 玩家ID
   * @description 清除玩家所有效果
   */
  clearAll (playerId) {
    this.registry.delete(playerId)
  }

  /**
   * @method list
   * @param {string} playerId — 玩家ID
   * @returns {Effect[]} — 效果列表（副本）
   * @description 列出玩家所有活跃效果
   */
  list (playerId) {
    const effects = this.registry.get(playerId)
    return effects ? [...effects] : []
  }

  /**
   * @method toJSON
   * @returns {Object} — EffectManager状态快照
   */
  toJSON () {
    const obj = {}
    for (const [playerId, effects] of this.registry.entries()) {
      obj[playerId] = effects.map(e => ({ ...e }))
    }
    return obj
  }
}

/**
 * @typedef {Object} Effect
 * @property {string} source  — 来源卡牌ID（如 "opportunity_008"）
 * @property {string} name    — 效果名称（如 "skip_turn"）
 * @property {number} rounds  — 剩余轮次（-1表示永久）
 * @property {Object} meta    — 附加数据
 */

export { EffectManager }
