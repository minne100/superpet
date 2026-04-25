/**
 * @class GameBus
 * @description 游戏内消息总线。
 *
 * 职责：
 * - 广播消息给所有玩家（如"轮到A行动"、"B使用了招式卡"）
 * - 单播消息给指定玩家（如"你被询问是否使用闪避卡"）
 * - 让 PlayerAgent 挂起等待特定消息，收到后自动唤醒
 *
 * 设计原则：
 * - 总线是游戏协调器，不包含任何游戏规则逻辑
 * - 每条消息都有 type 和 payload，Agent 按 type 过滤
 * - waitFor(filter) 返回 Promise，在匹配消息到达前一直挂起
 * - 将来网络版：把 send/broadcast 换成 WebRTC DataChannel 发送即可
 *
 * 消息格式：
 * {
 *   type: string,        // 消息类型（见 MSG 常量）
 *   from: string|'sys',  // 发送方 playerId 或 'sys'（系统）
 *   to: string|'all',    // 接收方 playerId 或 'all'（广播）
 *   payload: any         // 消息体
 * }
 */

/**
 * 消息类型常量
 */
export const MSG = {
  // ===== 系统/流程消息 =====
  AGENT_READY:      'AGENT_READY',       // Agent 已就绪，等待 GAME_START
  AGENT_TURN_READY: 'AGENT_TURN_READY', // Agent 已注册 YOUR_TURN waiter，可以发 YOUR_TURN
  // ===== 开局阶段 =====
  HOST_DECLARED:     'HOST_DECLARED',     // 发起者宣布（广播）
  DECK_SEEDS:        'DECK_SEEDS',        // 发起者广播洗牌种子（广播）
  RESHUFFLE:         'RESHUFFLE',         // 某牌堆触发重洗（含种子，由发起者/AI托管广播）
  ORDER_DICE_RESULT: 'ORDER_DICE_RESULT', // 排序投骰结果（广播）
  ORDER_DECIDED:     'ORDER_DECIDED',     // 跑圈顺序确定（广播）
  PET_ASSIGNED:      'PET_ASSIGNED',      // 宠物分配结果（广播）
  TALENT_DEALT:      'TALENT_DEALT',      // 天赋卡发放（广播）
  START_POS_ASSIGNED:'START_POS_ASSIGNED',// 起点分配结果（广播）
  GAME_START:        'GAME_START',        // 游戏开始，携带初始状态
  GAME_OVER:        'GAME_OVER',         // 游戏结束，携带最终结果
  YOUR_TURN:        'YOUR_TURN',         // 轮到你行动
  TURN_END:         'TURN_END',          // 某玩家回合结束
  ROUND_END:        'ROUND_END',         // 一整轮结束

  // ===== 跑圈消息 =====
  DICE_REQUEST:     'DICE_REQUEST',      // 系统请求玩家投骰
  DICE_RESULT:      'DICE_RESULT',       // 玩家投骰结果（广播）
  MOVE_REQUEST:     'MOVE_REQUEST',      // 系统请求玩家选择路口方向
  MOVE_RESULT:      'MOVE_RESULT',       // 玩家移动结果（广播）
  CELL_EFFECT:      'CELL_EFFECT',       // 格子触发效果（广播）

  // ===== 卡牌消息 =====
  CARD_DRAWN:       'CARD_DRAWN',        // 抽到卡牌（广播）
  CARD_CHOICE:      'CARD_CHOICE',       // 系统要求玩家做卡牌选择（单播）
  CARD_CHOICE_MADE: 'CARD_CHOICE_MADE',  // 玩家做出卡牌选择（广播）

  // ===== 比武消息 =====
  BATTLE_START:     'BATTLE_START',      // 比武开始（广播）
  PLACE_REQUEST:    'PLACE_REQUEST',     // 请求玩家选择初始位置（单播）
  PLACE_DONE:       'PLACE_DONE',        // 玩家选好位置（广播）
  ATTACK_REQUEST:   'ATTACK_REQUEST',    // 请求玩家出招（单播）
  ATTACK_RESULT:    'ATTACK_RESULT',     // 出招结果（广播）
  DODGE_REQUEST:    'DODGE_REQUEST',     // 询问是否使用闪避（单播）
  DODGE_RESPONSE:   'DODGE_RESPONSE',    // 闪避决定（广播）
  BATTLE_MOVE_REQ:  'BATTLE_MOVE_REQ',   // 请求玩家移动（单播）
  BATTLE_MOVE_DONE: 'BATTLE_MOVE_DONE',  // 移动完成（广播）
  PLAYER_ELIMINATED:'PLAYER_ELIMINATED', // 玩家被淘汰（广播）
  BATTLE_END:       'BATTLE_END',        // 比武结束（广播）
}

export class GameBus {
  constructor () {
    /**
     * @type {Map<string, Array<{resolve: Function, filter: Function}>>}
     * 每个 playerId 的等待队列
     */
    this._waiters = new Map()

    /**
     * @type {Array<Object>}
     * 消息历史（调试用）
     */
    this.history = []
  }

  /**
   * @method send
   * @param {Object} msg — 消息对象 { type, from, to, payload }
   * @description 发送一条消息。
   * - to='all'：广播给所有等待的 Agent
   * - to=playerId：单播给指定 Agent
   * 唤醒所有 filter(msg)===true 的等待者。
   */
  send (msg) {
    this.history.push(msg)

    const targets = msg.to === 'all'
      ? [...this._waiters.keys()]
      : [msg.to]

    for (const pid of targets) {
      const queue = this._waiters.get(pid)
      if (!queue) continue

      // 找到匹配的等待者并唤醒
      for (let i = queue.length - 1; i >= 0; i--) {
        const waiter = queue[i]
        if (waiter.filter(msg)) {
          queue.splice(i, 1)
          waiter.resolve(msg)
          break  // 每条消息只唤醒一个等待者（先进先出）
        }
      }
    }
  }

  /**
   * @method broadcast
   * @param {string} type — 消息类型
   * @param {any} payload — 消息体
   * @param {string} [from='sys'] — 发送方
   * @description 向所有玩家广播一条系统消息
   */
  broadcast (type, payload, from = 'sys') {
    this.send({ type, from, to: 'all', payload })
  }

  /**
   * @method unicast
   * @param {string} to — 目标 playerId
   * @param {string} type — 消息类型
   * @param {any} payload — 消息体
   * @param {string} [from='sys'] — 发送方
   * @description 向指定玩家发送单播消息
   */
  unicast (to, type, payload, from = 'sys') {
    this.send({ type, from, to, payload })
  }

  /**
   * @method waitFor
   * @param {string} playerId — 等待方的 playerId
   * @param {Function} filter — (msg) => boolean，匹配规则
   * @returns {Promise<Object>} — 收到匹配消息时 resolve
   * @description Agent 调用此方法挂起自身，直到收到满足 filter 的消息。
   *
   * 用法：
   *   const msg = await bus.waitFor('A', m => m.type === MSG.YOUR_TURN)
   */
  waitFor (playerId, filter) {
    return new Promise(resolve => {
      if (!this._waiters.has(playerId)) {
        this._waiters.set(playerId, [])
      }
      this._waiters.get(playerId).push({ resolve, filter })
    })
  }

  /**
   * @method waitForType
   * @param {string} playerId — 等待方
   * @param {string} type — 消息类型
   * @returns {Promise<Object>}
   * @description waitFor 的快捷版：按消息类型等待
   */
  waitForType (playerId, type) {
    return this.waitFor(playerId, msg => msg.type === type)
  }

  /**
   * @method waitForTypes
   * @param {string} playerId — 等待方
   * @param {string[]} types — 消息类型列表（任一匹配即唤醒）
   * @returns {Promise<Object>}
   */
  waitForTypes (playerId, types) {
    return this.waitFor(playerId, msg => types.includes(msg.type))
  }

  /**
   * @method clearWaiters
   * @description 清除所有挂起的等待者（游戏结束时调用，防止内存泄漏）
   */
  clearWaiters () {
    this._waiters.clear()
  }
}
