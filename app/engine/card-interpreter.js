/**
 * @class CardInterpreter
 * @description 卡牌JSON解释器。解析卡牌JSON中的steps数组，逐条执行。
 *
 * 卡牌JSON格式（以event_003为例）：
 * steps: [
 *   { id: "dice_loop", action: "loop", who: "$all", do: [...] },
 *   { id: "calc_min", action: "calc", ... },
 *   ...
 * ]
 *
 * 核心逻辑：
 * - action!=='?' → 直接执行，role决定谁参与
 * - action=='?' → 从role对象中根据当前节点身份选择子动作
 * - action=='loop' → 遍历玩家列表，对每个玩家执行do[]
 *
 * 在模拟器/单机模式时，engine引用非空，add_gold/remove_gold等
 * 实际操作类动作直接调用engine的方法执行。
 */

class CardInterpreter {
  /**
   * @param {Object} options
   * @param {Object} [options.engine=null] — GameEngine引用
   */
  constructor ({ engine = null } = {}) {
    /** @type {Object|null} 宿主引擎引用 */
    this.engine = engine

    /** @type {Object} 当前卡牌JSON */
    this.card = null

    /** @type {Object} 执行上下文 */
    this.context = {}

    /** @type {number} 当前step索引 */
    this.currentStepIndex = 0

    /** @type {number} 当前loop迭代索引（嵌套loop时用） */
    this.loopIndex = 0

    /** @type {Array|null} 当前loop的迭代器 */
    this.loopIterator = null
  }

  /**
   * @method interpret
   * @param {Object} cardJson — 卡牌JSON对象
   * @param {Object} context — 执行上下文
   * @param {string} context.triggerPlayerId — 触发该卡牌的玩家ID
   * @param {Object} [context.diceResults] — 骰子结果 { playerId: value }
   * @param {string[]} [context.playerOrder] — 玩家顺序（用于loop）
   * @returns {ExecutionResult}
   * @description 开始解释执行卡牌steps数组
   */
  interpret (cardJson, context) {
    this.card = cardJson
    this.context = { ...context }
    this.currentStepIndex = -1
    this.loopIndex = 0
    this.loopIterator = null

    // 如果有engine传入，放到context中方便getEngine()
    if (!this.context.engine && this.engine) {
      this.context.engine = this.engine
    }

    // 无steps的卡牌（招式卡/内功卡）直接完成
    if (!cardJson.steps || cardJson.steps.length === 0) {
      return this.#completeResult()
    }

    return this.#processSteps(cardJson.steps)
  }

  /**
   * @method #getEngine
   * @private
   * @returns {Object|null}
   * @description 获取引擎引用（优先从context，其次从实例字段）
   */
  #getEngine () {
    return this.context.engine || this.engine
  }

  /**
   * @method #processSteps
   * @private
   * @param {Object[]} steps — 卡牌steps数组
   * @param {string} [loopPlayerId] — 如果是loop中，当前遍历的玩家ID
   * @returns {ExecutionResult}
   * @description 依次处理steps数组中的每个step
   */
  #processSteps (steps, loopPlayerId) {
    const allEffects = []
    for (let i = 0; i < steps.length; i++) {
      this.currentStepIndex = i
      const step = steps[i]
      const action = step.action || '?'

      if (action === 'loop') {
        const result = this.#executeLoop(step)
        if (result.waitFor) return result
        if (result.effects && result.effects.length > 0) {
          allEffects.push(...result.effects)
        }
        continue
      }

      const result = this.#executeAction(step, action, loopPlayerId)
      if (result.waitFor) return result
      if (result.effects && result.effects.length > 0) {
        allEffects.push(...result.effects)
      }
    }

    return this.#completeResult(allEffects)
  }

  /**
   * @method #executeAction
   * @private
   * @param {Object} step — 单步定义
   * @param {string} action — action字段值
   * @param {string} [loopPid] — 当前遍历的玩家ID（如果来自loop）
   * @returns {ExecutionResult}
   * @description 执行单个action
   */
  #executeAction (step, action, loopPid) {
    const role = step.role || 'all'
    const effectiveAction = this.#resolveAction(action, role)

    switch (effectiveAction) {
      // ---- 玩家输入类（需要等待） ----
      case 'roll_dice': {
        // 检查是否有模拟骰子结果
        const playerId = loopPid || step.player || this.context.triggerPlayerId
        if (this.context.diceResults && this.context.diceResults[playerId]) {
          // 使用模拟结果
          const diceValue = this.context.diceResults[playerId]
          if (step.store_as) {
            this.context[step.store_as] = diceValue
          }
          return this.#completeResult()
        }
        return this.#makeWait('roll_dice', step, loopPid)
      }
      case 'wait_dice':
        return this.#makeWait('wait_dice', step, loopPid)
      case 'reveal_and_pick':
        // 检查是否有模拟选择结果
        if (this.context.choices && this.context.choices.pick_card) {
          return this.#completeResult()
        }
        return this.#makeWait('pick_card', step, loopPid)
      case 'wait_pick':
        return this.#makeWait('wait_pick', step, loopPid)
      case 'pick_card':
        // 检查是否有模拟选择结果
        if (this.context.choices && this.context.choices.pick_card) {
          return this.#completeResult()
        }
        return this.#makeWait('pick_card', step, loopPid)
      case 'pick_and_return':
        // 检查是否有模拟选择结果
        if (this.context.choices && this.context.choices.pick_and_return) {
          return this.#completeResult()
        }
        return this.#makeWait('pick_and_return', step, loopPid)
      case 'player_choice':
        // 检查是否有模拟选择结果
        if (this.context.choices && this.context.choices.choose_player) {
          return this.#completeResult()
        }
        return this.#makeWait('choose_player', step, loopPid)
      case 'choose_discard':
        // 检查是否有模拟选择结果
        if (this.context.choices && this.context.choices.discard) {
          return this.#completeResult()
        }
        return this.#makeWait('discard', step, loopPid)

      // ---- 纯内部运算类（直接执行） ----
      case 'calc':
      case 'broadcast':
      case 'notify_all':
      case 'wait':
        return this.#completeResult()

      // ---- 需要engine实际操作的动作 ----
      case 'add_gold':
        return this.#applyEngineAction('add_gold', step, loopPid)
      case 'remove_gold':
        return this.#applyEngineAction('remove_gold', step, loopPid)
      case 'transfer_gold':
        return this.#applyEngineAction('transfer_gold', step, loopPid)
      case 'transfer_card':
        return this.#applyEngineAction('transfer_card', step, loopPid)
      case 'draw_card':
        return this.#applyEngineAction('draw_card', step, loopPid)
      case 'discard_card':
        return this.#applyEngineAction('discard_card', step, loopPid)
      case 'random_discard':
        return this.#applyEngineAction('random_discard', step, loopPid)
      case 'debuff':
        return this.#applyEngineAction('debuff', step, loopPid)
      case 'perm_buff':
        return this.#applyEngineAction('perm_buff', step, loopPid)
      case 'buff_next_cultivation':
        return this.#applyEngineAction('buff_next_cultivation', step, loopPid)
      case 'immediate_cultivate':
        return this.#applyEngineAction('immediate_cultivate', step, loopPid)
      case 'advance':
        return this.#applyEngineAction('advance', step, loopPid)
      case 'return_to_deck':
        return this.#applyEngineAction('return_to_deck', step, loopPid)
      case 'negate_damage':
        return this.#applyEngineAction('negate_damage', step, loopPid)

      // ---- 控制流 ----
      case 'if':
        return this.#applyEngineAction('if', step, loopPid)
      case 'goto':
        return this.#completeResult()
      case 'end':
        return this.#completeResult()
      case 'has_cards?':
        return this.#applyEngineAction('has_cards?', step, loopPid)
      case 'store':
        return this.#completeResult()

      default:
        return this.#completeResult()
    }
  }

  /**
   * @method #applyEngineAction
   * @private
   * @param {string} action — 动作名
   * @param {Object} step — step定义（含value/from等参数）
   * @param {string} [loopPid] — 当前遍历的玩家ID
   * @returns {ExecutionResult}
   * @description 通过engine执行实际游戏操作。
   * 如果engine不可用（模拟器模式），不执行任何操作，直接返回完成。
   */
  #applyEngineAction (action, step, loopPid) {
    const engine = this.#getEngine()
    if (!engine) {
      return this.#completeResult()
    }

    // 解析玩家ID：优先loopPid，其次step.player，再次triggerPlayer
    let pid = loopPid || step.player || this.context.triggerPlayerId
    // 解析$trigger等特殊变量
    if (typeof pid === 'string' && pid.startsWith('$')) {
      const varName = pid.slice(1)
      if (varName === 'trigger') {
        pid = this.context.triggerPlayerId
      } else if (this.context[varName]) {
        pid = this.context[varName]
      }
    }
    if (!pid) {
      return this.#completeResult()
    }

    const player = engine.getPlayer(pid)
    if (!player) {
      return this.#completeResult()
    }

    const effects = []

    switch (action) {
      case 'add_gold': {
        let amount = step.value || 0
        // 检查是否是变量
        if (typeof amount === 'string' && amount.startsWith('$')) {
          const varName = amount.slice(1)
          if (this.context[varName] !== undefined) {
            amount = this.context[varName]
          }
        }
        player.addGold(amount)
        effects.push({ type: 'add_gold', desc: `${player.name || pid} 获得 ${amount} 金币` })
        break
      }

      case 'remove_gold': {
        const amount = step.value || 0
        const actual = player.removeGold(amount)
        effects.push({ type: 'remove_gold', desc: `${player.name || pid} 失去 ${actual} 金币` })
        break
      }

      case 'transfer_gold': {
        const fromPid = step.from || this.context.triggerPlayerId
        const toPid = step.to || (loopPid || this.context.triggerPlayerId)
        const amount = step.value || step.amount || 0
        const fromPlayer = engine.getPlayer(fromPid)
        const toPlayer = engine.getPlayer(toPid)
        if (fromPlayer && toPlayer) {
          const actual = fromPlayer.removeGold(amount)
          toPlayer.addGold(actual)
          effects.push({ type: 'transfer_gold', desc: `${fromPlayer.name || fromPid} 向 ${toPlayer.name || toPid} 转移 ${actual} 金币` })
        }
        break
      }

      case 'transfer_card': {
        const fromPid = step.from || this.context.triggerPlayerId
        const toPid = step.to || (loopPid || this.context.triggerPlayerId)
        const cardType = step.type || 'move'
        const fromPlayer = engine.getPlayer(fromPid)
        const toPlayer = engine.getPlayer(toPid)
        if (fromPlayer && toPlayer && fromPlayer.hand[cardType] && fromPlayer.hand[cardType].length > 0) {
          const card = fromPlayer.hand[cardType].pop()
          toPlayer.addCard(cardType, card)
          effects.push({ type: 'transfer_card', desc: `${fromPlayer.name || fromPid} 向 ${toPlayer.name || toPid} 转移1张${cardType === 'move' ? '招式' : '内功'}卡` })
        }
        break
      }

      case 'draw_card': {
        const type = step.type || 'move'
        const deck = engine.decks[type]
        if (deck && deck.length > 0) {
          const card = deck.pop()
          if (card) {
            player.addCard(type, card)
            effects.push({ type: 'draw_card', desc: `${player.name || pid} 抽到${type === 'move' ? '招式' : '内功'}卡 [${card.cardId}]` })
          }
        }
        break
      }

      case 'discard_card':
      case 'random_discard': {
        const type = step.type || 'move'
        if (player.hand[type] && player.hand[type].length > 0) {
          const idx = Math.floor(Math.random() * player.hand[type].length)
          const card = player.hand[type][idx]
          player.removeCard(type, card.cardId)
          effects.push({ type: 'discard_card', desc: `${player.name || pid} 丢弃1张${type === 'move' ? '招式' : '内功'}卡 [${card.cardId}]` })
        }
        break
      }

      case 'perm_buff': {
        let buffDesc = ''
        if (step.attack) {
          player.modifyAttack(step.attack)
          buffDesc += `攻击+${step.attack} `
        }
        if (step.defense) {
          player.modifyDefense(step.defense)
          buffDesc += `防御+${step.defense} `
        }
        if (buffDesc) {
          effects.push({ type: 'perm_buff', desc: `${player.name || pid} ${buffDesc.trim()}` })
        }
        break
      }

      case 'debuff': {
        let debuffDesc = ''
        if (step.attack) {
          const oldAttack = player.attack
          const newAttack = Math.max(1, player.attack - step.attack)
          player.attack = newAttack
          debuffDesc += `攻击-${step.attack} `
        }
        if (step.defense) {
          const oldDefense = player.defense
          const newDefense = Math.max(1, player.defense - step.defense)
          player.defense = newDefense
          debuffDesc += `防御-${step.defense} `
        }
        if (step.effect) {
          if (engine.effectManager) {
            engine.effectManager.add(player.id, step.effect, 1, { source: this.card?.cardId })
          }
          const effectNames = {
            'skip_turn': '下回合轮空',
            'dice_x2': '下次投骰子×2',
            'dice_half': '下次投骰子÷2',
            'cultivation_x2': '下次修炼效果×2',
            'cultivation_skip': '下次修炼无效',
            'extra_draw_move': '下次额外抽招式卡',
            'redraw_once': '下次不满意可重新抽卡',
            'rest_cultivate': '下次休整时可修炼',
            'double_roll': '下次可投两次骰子',
            'no_draw': '下次无法抽卡',
            'next_turn_choose_step': '下次可选择步数'
          }
          debuffDesc += `获得【${effectNames[step.effect] || step.effect}】效果 `
        }
        if (debuffDesc) {
          effects.push({ type: 'debuff', desc: `${player.name || pid} ${debuffDesc.trim()}` })
        }
        break
      }

      case 'buff_next_cultivation': {
        // 使用EffectManager添加修炼加成效果
        if (engine.effectManager) {
          engine.effectManager.add(player.id, 'cultivation_x2', 1)
          effects.push({ type: 'buff_next_cultivation', desc: `${player.name || pid} 获得下次修炼双倍效果` })
        }
        break
      }

      case 'immediate_cultivate': {
        // 立即修炼（攻击+1, 防御+1）
        player.modifyAttack(1)
        player.modifyDefense(1)
        effects.push({ type: 'immediate_cultivate', desc: `${player.name || pid} 立即修炼：攻击+1 防御+1` })
        break
      }

      case 'advance': {
        const steps = step.value || step.steps || 0
        const direction = step.direction === 'backward' ? '后退' : '前进'
        // 调整位置（仅数值，不触发格子效果）
        const maxPos = engine.board ? engine.board.getTotalCells() - 1 : 31
        const oldPos = player.position
        if (step.direction === 'backward') {
          const newPos = (player.position - steps + maxPos + 1) % (maxPos + 1)
          player.position = newPos
        } else {
          const newPos = (player.position + steps) % (maxPos + 1)
          player.position = newPos
        }
        effects.push({ type: 'advance', desc: `${player.name || pid} ${direction} ${steps} 步：[${oldPos}] → [${player.position}]` })
        break
      }

      case 'return_to_deck': {
        const type = step.type || 'move'
        const deck = engine.decks[type]
        if (deck && player.hand[type] && player.hand[type].length > 0) {
          // 从手牌中随机取一张放回牌堆顶
          const idx = Math.floor(Math.random() * player.hand[type].length)
          const card = player.hand[type][idx]
          player.removeCard(type, card.cardId)
          deck.push(card)
          effects.push({ type: 'return_to_deck', desc: `${player.name || pid} 将1张${type === 'move' ? '招式' : '内功'}卡 [${card.cardId}] 放回牌堆` })
        }
        break
      }

      case 'negate_damage': {
        // 为玩家添加一次免伤效果
        if (engine.effectManager) {
          engine.effectManager.add(player.id, 'negate_damage', 1, { remaining: 1 })
          effects.push({ type: 'negate_damage', desc: `${player.name || pid} 获得一次免伤效果` })
        }
        break
      }

      case 'has_cards?': {
        // if条件判断——数量检查
        const type = step.type || 'move'
        const count = player.hand[type] ? player.hand[type].length : 0
        const expected = step.count || step.value || 1
        let conditionDesc = ''
        if (step.compare === '>=') {
          conditionDesc = `拥有${type === 'move' ? '招式' : '内功'}卡 >= ${expected}`
        } else if (step.compare === '>') {
          conditionDesc = `拥有${type === 'move' ? '招式' : '内功'}卡 > ${expected}`
        } else if (step.compare === '<=') {
          conditionDesc = `拥有${type === 'move' ? '招式' : '内功'}卡 <= ${expected}`
        } else if (step.compare === '<') {
          conditionDesc = `拥有${type === 'move' ? '招式' : '内功'}卡 < ${expected}`
        } else if (step.compare === '!=') {
          conditionDesc = `拥有${type === 'move' ? '招式' : '内功'}卡 != ${expected}`
        } else {
          conditionDesc = `拥有${type === 'move' ? '招式' : '内功'}卡 = ${expected}`
        }
        const result = count >= expected ? '满足' : '不满足'
        effects.push({ type: 'has_cards?', desc: `${player.name || pid} ${conditionDesc}：${result}（当前${count}张）` })
        return this.#completeResult(effects)
      }

      case 'if':
        // if的condition由calc预先计算，直接完成不处理
        return this.#completeResult(effects)

      default:
        return this.#completeResult(effects)
    }

    return this.#completeResult(effects)
  }

  /**
   * @method #resolveAction
   * @private
   * @param {string} action — step的action字段
   * @param {string|Object} role — step的role字段
   * @returns {string} — 最终要执行的动作名
   * @description 当action='?'时，从role中根据当前节点身份选取子动作。
   */
  #resolveAction (action, role) {
    if (action !== '?') return action

    if (typeof role === 'object' && role !== null) {
      const identity = this.#getNodeIdentity()
      if (role[identity]) {
        const sub = role[identity]
        if (typeof sub === 'string') {
          return sub
        }
        if (typeof sub === 'object' && sub.action) {
          return sub.action
        }
      }
      const firstKey = Object.keys(role)[0]
      const first = role[firstKey]
      return typeof first === 'string' ? first : (first.action || 'wait')
    }

    return 'wait'
  }

  /**
   * @method #executeLoop
   * @private
   * @param {Object} step — loop step定义
   * @returns {ExecutionResult}
   * @description 执行loop：遍历who指定的玩家列表
   */
  #executeLoop (step) {
    const who = step.who || '$all'
    const players = this.#resolvePlayerList(who)
    const loopEffects = []

    for (const pid of players) {
      const processedDo = this.#substituteVar(step.do, pid)
      const result = this.#processSteps(processedDo, pid)
      if (result.waitFor) return result
      if (result.effects && result.effects.length > 0) {
        loopEffects.push(...result.effects)
      }
    }

    return this.#completeResult(loopEffects)
  }

  /**
   * @method #resolvePlayerList
   * @private
   * @param {string} whoSpec — who字段
   * @returns {string[]}
   */
  #resolvePlayerList (whoSpec) {
    const allPlayers = this.context.playerOrder || ['A', 'B', 'C', 'D']
    const trigger = this.context.triggerPlayerId

    switch (whoSpec) {
      case '$all':
        return allPlayers
      case '$trigger':
        return [trigger]
      case '$others':
        return allPlayers.filter(p => p !== trigger)
      default:
        if (typeof whoSpec === 'string' && whoSpec.startsWith('$')) {
          const key = whoSpec.slice(1)
          const val = this.context[key]
          if (Array.isArray(val)) return val
          return [val || trigger]
        }
        return allPlayers
    }
  }

  /**
   * @method #getNodeIdentity
   * @private
   * @returns {string} 'actor'|'target'|'others'|'all'
   * @description 在模拟器模式下，当前节点始终是actor
   */
  #getNodeIdentity () {
    return 'actor'
  }

  /**
   * @method #substituteVar
   * @private
   * @param {Object|Array} obj — 含{p}的对象/数组
   * @param {string} pid — 玩家ID
   * @returns {Object|Array} — 替换后的副本
   */
  #substituteVar (obj, pid) {
    if (typeof obj === 'string') {
      return obj.replace(/\{p\}/g, pid)
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.#substituteVar(item, pid))
    }
    if (obj && typeof obj === 'object') {
      const result = {}
      for (const [key, val] of Object.entries(obj)) {
        result[key] = this.#substituteVar(val, pid)
      }
      return result
    }
    return obj
  }

  /**
   * @method #makeWait
   * @private
   */
  #makeWait (type, step, loopPid) {
    return {
      complete: false,
      waitFor: type,
      effects: [],
      broadcasts: []
    }
  }

  /**
   * @method #completeResult
   * @private
   * @param {Array} [effects=[]] - 执行效果描述
   * @returns {ExecutionResult}
   */
  #completeResult (effects = []) {
    return {
      complete: true,
      effects: effects,
      broadcasts: [],
      waitFor: null
    }
  }

  /**
   * @method continueFrom
   * @param {number} stepIndex
   * @returns {ExecutionResult}
   */
  continueFrom (stepIndex) {
    if (!this.card || !this.card.steps) {
      return this.#completeResult()
    }
    return this.#processSteps(this.card.steps.slice(stepIndex))
  }

  /**
   * @method toJSON
   * @returns {Object}
   */
  toJSON () {
    return {
      cardId: this.card ? this.card.cardId : null,
      currentStepIndex: this.currentStepIndex,
      context: { ...this.context }
    }
  }
}

/**
 * @typedef {Object} ExecutionResult
 * @property {boolean} complete
 * @property {string|null} waitFor
 * @property {Array} effects
 * @property {Array} broadcasts
 */

export { CardInterpreter }
