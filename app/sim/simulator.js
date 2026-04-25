/**
 * @class Simulator
 * @description Monte Carlo 模拟器（多协程版本）。
 *
 * 架构：
 *   每局游戏启动4个独立的 PlayerAgent 协程，各自等待消息、做出决策。
 *   GameCoordinator（内嵌于 runSingleGame）作为裁判，驱动游戏流程，
 *   通过 GameBus 广播/单播消息，各 Agent 挂起等待后自动唤醒。
 *
 *   Promise.all([agent_A.run(), agent_B.run(), agent_C.run(), agent_D.run()])
 *   四个协程同时运行，总线协调顺序。
 *
 * 将来 AI 托管：
 *   掉线玩家直接用 PlayerAgent 接管，行为完全一致。
 * 将来真实玩家：
 *   创建 HumanPlayerAgent 继承 PlayerAgent，
 *   _decideJunction/_decideCardChoice 改为等待网络输入。
 */
import { GameEngine } from '../engine/game-engine.js'
import { GameBus, MSG } from './game-bus.js'
import { PlayerAgent } from './player-agent.js'
import { GameLogger } from './game-logger.js'

/**
 * @class SimResult
 * @description 单局模拟结果
 */
export class SimResult {
  constructor () {
    this.gameIndex = 0
    this.totalRounds = 0
    this.winner = null
    this.rankings = []
    this.finalGold = []
    this.finalAttack = []
    this.finalDefense = []
    this.cardUsage = {}
    this.diceRolls = 0
    this.combatCount = 0
  }
}

/**
 * @class SimStats
 * @description 多局统计聚合
 */
export class SimStats {
  constructor () {
    this.totalGames = 0
    this.wins = [0, 0, 0, 0]
    this.avgRankings = []
    this.avgGold = []
    this.avgAttack = []
    this.avgDefense = []
    this.avgRounds = 0
    this.medianRounds = 0
    this.minRounds = Infinity
    this.maxRounds = 0
    this.cardEfficiency = []
    this.goldDistribution = {}
  }
}

export class Simulator {
  /**
   * @param {Object} config
   * @param {string} [config.mode='standard']
   * @param {boolean} [config.verbose=false]
   * @param {number} [config.seedBase=Date.now()]
   */
  constructor (config = {}) {
    this.config = {
      mode: config.mode || 'standard',
      verbose: config.verbose ?? false,
      seedBase: config.seedBase ?? Date.now(),
      maxTurns: config.maxTurns ?? 500,
      // trace: 开启后 runSingleGame 的结果会附带 result.log（完整游戏日志文本）
      trace: config.trace ?? false
    }
  }

  /**
   * @method runGames
   * @param {number} count
   * @returns {Promise<SimStats>}
   */
  async runGames (count) {
    if (this.config.verbose) {
      console.log(`开始模拟 ${count} 局...`)
    }

    const results = []
    for (let i = 0; i < count; i++) {
      const result = await this.runSingleGame(i)
      results.push(result)

      if (this.config.verbose && (i + 1) % 100 === 0) {
        const pct = (((i + 1) / count) * 100).toFixed(1)
        console.log(`  ${i + 1}/${count} (${pct}%) | 胜者: ${result.winner} | 回合: ${result.totalRounds}`)
      }
    }

    return this.#aggregateResults(results)
  }

  /**
   * @method runSingleGame
   * @param {number} gameIndex
   * @returns {Promise<SimResult>}
   * @description 运行一局游戏。
   *
   * 流程：
   *   1. 创建 GameEngine、GameBus
   *   2. 创建4个 PlayerAgent，同时启动（Promise.all）
   *   3. GameCoordinator 驱动游戏主循环：
   *      a. 广播 GAME_START
   *      b. 循环：广播 YOUR_TURN → 等待 TURN_END → 推进引擎 → 检查终局
   *      c. 广播 GAME_OVER，解除所有挂起的 Agent
   *   4. 收集结果
   */
  async runSingleGame (gameIndex) {
    const seed = this.config.seedBase + gameIndex * 1000
    const engine = new GameEngine({ seed, mode: this.config.mode })
    engine.init()
    // 注意：起点、宠物、顺序由 Coordinator 的开局流程负责，不在这里设置

    const bus = new GameBus()
    const playerIds = engine.players.map(p => p.id)

    // 创建4个 Agent 协程
    const agents = playerIds.map(id => new PlayerAgent(id, bus, engine))

    const result = new SimResult()
    result.gameIndex = gameIndex

    // Logger（trace模式时创建，否则为null）
    const logger = this.config.trace ? new GameLogger() : null

    // Coordinator：游戏主循环（独立的 async 函数）
    const coordinatorDone = this.#runCoordinator(engine, bus, playerIds, result, logger)

    // 同时启动：4个 Agent + 1个 Coordinator
    await Promise.all([
      coordinatorDone,
      ...agents.map(a => a.run())
    ])

    bus.clearWaiters()

    // 如果是 trace 模式，把日志挂到结果上
    if (logger) result.log = logger.render()

    return result
  }

  /**
   * @method #runCoordinator
   * @private
   * @description 游戏协调器。驱动回合顺序，广播消息，检查终局。
   * 不做任何游戏决策，只负责流程控制。
   */
  async #runCoordinator (engine, bus, playerIds, result, logger = null) {
    const COORD = '_coordinator'
    let turnCount = 0

    // 等所有 Agent 注册好 GAME_START waiter 后再广播
    await Promise.all(
      playerIds.map(id => bus.waitFor(COORD, m =>
        m.type === MSG.AGENT_READY && m.payload?.playerId === id
      ))
    )

    // ===== 开局阶段 =====

    // Step 0: 发起者宣布（规则书 §4.1：房主创建房间，负责确定洗牌种子）
    // 模拟器中取第一个玩家为发起者，在线版为房主
    const hostId = playerIds[0]
    bus.broadcast(MSG.HOST_DECLARED, { hostId })
    if (logger) logger.recordHostDeclared(hostId)

    // Step 1: 发起者生成并广播洗牌种子（确保所有节点牌池顺序一致）
    // 模拟器中种子已由 GameEngine 内部 PRNG 生成，这里把已用的种子值广播出去供记录
    // 在线版：hostId 玩家调用 crypto.randomInt() 生成种子，广播给所有人，各节点再执行洗牌
    const deckSeeds = {
      move:        engine.seed,       // 展示用，实际洗牌已在 engine.init() 完成
      neigong:     engine.seed + 1,
      opportunity: engine.seed + 2,
      event:       engine.seed + 3
    }
    bus.broadcast(MSG.DECK_SEEDS, { hostId, seeds: deckSeeds })
    if (logger) logger.recordDeckSeeds(hostId, deckSeeds)

    // Step 2: 全员投骰决定跑圈顺序（规则书 §3.1）
    const { rolls, order } = engine.rollForOrder()
    bus.broadcast(MSG.ORDER_DICE_RESULT, { rolls })
    bus.broadcast(MSG.ORDER_DECIDED, { order })
    if (logger) logger.recordOrderDice(rolls, order)

    // Step 3: 按顺序分配宠物，同时发放天赋卡（规则书 §3.1，天赋为必须项）
    const PETS = ['猫', '狗', '兔子', '鹦鹉']
    const petAssignments = engine.assignPets(PETS)  // 返回含天赋卡的分配记录
    bus.broadcast(MSG.PET_ASSIGNED, { assignments: petAssignments })
    bus.broadcast(MSG.TALENT_DEALT, { assignments: petAssignments })
    if (logger) {
      logger.recordPetAssignment(order, PETS)
      logger.recordTalentDealt(petAssignments)
    }

    // Step 4: 按顺序分配起始休整格（规则书 §3.1）
    const startPositions = engine.board.getStartPositions()
    const posMap = {}
    order.forEach((id, i) => {
      posMap[id] = startPositions[i % startPositions.length]
    })
    engine.assignStartPositions(posMap)
    bus.broadcast(MSG.START_POS_ASSIGNED, { posMap })
    if (logger) logger.recordStartPositions(order, posMap, engine)

    // ===== 开局完成，广播游戏开始 =====
    bus.broadcast(MSG.GAME_START, { state: engine.getState() })

    while (!engine.gameOver && turnCount < this.config.maxTurns) {
      const currentId = engine.turnManager.getCurrentPlayer()
      const currentRound = engine.turnManager.round
      const turnInRound = engine.turnManager.actedThisRound + 1

      // 回合开始前：快照当前玩家状态
      const playerBefore = logger
        ? logger.snapshotPlayer(engine.getPlayer(currentId))
        : null

      if (logger) {
        logger.recordTurnStart(currentRound, turnInRound, currentId)
      }

      // 注册对 MOVE_RESULT 的监听（在 YOUR_TURN 之前注册，确保不丢失）
      const moveResultPromise = logger
        ? bus.waitFor(COORD, m =>
            m.type === MSG.MOVE_RESULT && m.payload?.playerId === currentId
          )
        : null

      // 注册 TURN_END 等待
      const turnEndPromise = bus.waitFor(COORD, m =>
        m.type === MSG.TURN_END && m.payload?.playerId === currentId
      )

      await new Promise(r => setImmediate(r))

      // 单播 YOUR_TURN
      bus.unicast(currentId, MSG.YOUR_TURN, { playerId: currentId })

      // 等待 MOVE_RESULT（如果有 logger）
      if (moveResultPromise) {
        const moveMsg = await moveResultPromise
        const mv = moveMsg.payload

        // 记录骰子（从步数反推不准确，步数就是骰子值）
        logger.recordDice(currentId, mv.steps)

        // 记录移动，带路口选择信息
        const junctionDetails = (mv.passedJunctions || []).map((j, i) => {
          const choiceIdx = mv.choices?.[i] ?? 0
          const board = engine.board
          const options = board.getNextCells(j.pos, null)
          const chosenDir = options[choiceIdx] ?? options[0]
          return { pos: j.pos, choiceIdx, chosenDir }
        })

        const cellType = engine.board.getType(mv.newPos)
        logger.recordMove(
          currentId,
          mv.oldPos,
          mv.newPos,
          cellType,
          mv.steps,
          junctionDetails
        )

        // 广播重洗牌事件（由发起者/AI托管负责广播种子，保证各节点一致）
        for (const ev of mv.cellEvents || []) {
          if (ev.type === 'reshuffle') {
            bus.broadcast(MSG.RESHUFFLE, {
              deckType: ev.deckType,
              seed: ev.seed,
              issuedBy: playerIds[0]  // 模拟器中发起者始终是第一位玩家
            })
            if (logger) logger.recordReshuffle(ev.deckType, ev.seed, playerIds[0])
          }
        }

        // 记录格子效果（等 TURN_END 后拿到最终状态）
        await turnEndPromise

        const playerAfter = logger.snapshotPlayer(engine.getPlayer(currentId))

        // 把 cellEvents 转为可读描述
        const effectDescs = this.#describeCellEvents(mv.cellEvents || [], engine)

        logger.recordCellEffect(
          currentId,
          cellType,
          effectDescs,
          playerBefore,
          playerAfter
        )
      } else {
        await turnEndPromise
      }

      turnCount++
      result.diceRolls++

      engine.applyAction({ type: 'NEXT_TURN', playerId: currentId })
    }

    // 游戏结束
    const finalResult = engine.getResult() || []
    bus.broadcast(MSG.GAME_OVER, { result: finalResult })

    if (logger) logger.recordGameEnd(finalResult)

    result.totalRounds = engine.turnManager.round
    result.rankings = finalResult
    result.winner = finalResult[0]?.id || playerIds[0]

    for (const p of engine.players) {
      result.finalGold.push(p.gold)
      result.finalAttack.push(p.attack)
      result.finalDefense.push(p.defense)
    }
  }

  /**
   * @method #describeCellEvents
   * @private
   * @description 把引擎返回的 cellEvents 数组转为可读中文描述
   */
  #describeCellEvents (cellEvents, engine) {
    const descs = []
    for (const ev of cellEvents) {
      switch (ev.type) {
        case 'rest_gold':
          descs.push({ desc: `休整，获得 ${ev.gain} 金币` })
          break
        case 'cultivate': {
          const statLabel = ev.stat === 'attack' ? '攻击' : '防御'
          if (ev.neigongUsed) {
            descs.push({ desc: `修炼（使用内功卡 ${ev.neigongUsed}）：${statLabel}+${ev.value}` })
          } else {
            descs.push({ desc: `修炼：${statLabel}+${ev.value}` })
          }
          break
        }
        case 'draw_move':
          descs.push({ desc: `抽到招式卡 [${ev.cardId}]` })
          break
        case 'reshuffle': {
          const deckNames = { neigong: '内功', opportunity: '机遇', event: '事件' }
          descs.push({ desc: `【${deckNames[ev.deckType] || ev.deckType}牌堆已抽空，弃牌重洗！种子:${ev.seed}】` })
          break
        }
        case 'draw_neigong':
          descs.push({ desc: `抽到内功卡 [${ev.cardId}]` })
          break
        case 'opportunity_executed':
          descs.push({ desc: `机遇卡 [${ev.cardId}] 已执行` })
          break
        case 'event_executed':
          descs.push({ desc: `事件卡 [${ev.cardId}] 已执行` })
          break
        case 'battle':
          if (ev.victorId) {
            descs.push({ desc: `比武触发！胜者：${ev.victorId}，金币转移 ${ev.goldTransfer || 0}` })
          } else {
            descs.push({ desc: `比武触发！结果：${ev.outcome}` })
          }
          break
        default:
          descs.push({ desc: `[${ev.type}]` })
      }
    }
    return descs
  }

  /**
   * @method #aggregateResults
   * @private
   */
  #aggregateResults (results) {
    const stats = new SimStats()
    stats.totalGames = results.length
    const roundsList = []

    for (const r of results) {
      roundsList.push(r.totalRounds)

      for (const rankEntry of r.rankings) {
        const idx = ['A', 'B', 'C', 'D'].indexOf(rankEntry.id)
        if (idx >= 0 && rankEntry.rank === 1) stats.wins[idx]++
      }

      if (stats.avgGold.length === 0) {
        stats.avgGold = [...r.finalGold]
        stats.avgAttack = [...r.finalAttack]
        stats.avgDefense = [...r.finalDefense]
      } else {
        for (let i = 0; i < r.finalGold.length; i++) {
          stats.avgGold[i] += r.finalGold[i]
          stats.avgAttack[i] += r.finalAttack[i]
          stats.avgDefense[i] += r.finalDefense[i]
        }
      }
    }

    const n = results.length
    stats.avgGold = stats.avgGold.map(v => +(v / n).toFixed(2))
    stats.avgAttack = stats.avgAttack.map(v => +(v / n).toFixed(2))
    stats.avgDefense = stats.avgDefense.map(v => +(v / n).toFixed(2))

    roundsList.sort((a, b) => a - b)
    stats.avgRounds = +(roundsList.reduce((a, b) => a + b, 0) / n).toFixed(2)
    stats.minRounds = roundsList[0]
    stats.maxRounds = roundsList[roundsList.length - 1]
    stats.medianRounds = roundsList[Math.floor(roundsList.length / 2)]
    stats.wins = stats.wins.map(w => +(w / n * 100).toFixed(2))

    return stats
  }

  /**
   * @method printReport
   * @param {SimStats} stats
   * @returns {string}
   */
  printReport (stats) {
    const lines = []
    lines.push('='.repeat(50))
    lines.push('  《超级宠物》Phase 1 数值模拟报告')
    lines.push(`  对局数: ${stats.totalGames}`)
    lines.push('='.repeat(50))
    lines.push('')
    lines.push('【回合统计】')
    lines.push(`  平均回合:  ${stats.avgRounds}`)
    lines.push(`  中位回合:  ${stats.medianRounds}`)
    lines.push(`  最短回合:  ${stats.minRounds}`)
    lines.push(`  最长回合:  ${stats.maxRounds}`)
    lines.push('')
    lines.push('【胜率统计】')
    for (let i = 0; i < 4; i++) {
      const pid = ['A', 'B', 'C', 'D'][i]
      lines.push(`  玩家${pid}: ${stats.wins[i]}%`)
    }
    lines.push('')
    lines.push('【终局平均属性】')
    for (let i = 0; i < 4; i++) {
      const pid = ['A', 'B', 'C', 'D'][i]
      lines.push(`  玩家${pid}: 金币=${stats.avgGold[i]} 攻击=${stats.avgAttack[i]} 防御=${stats.avgDefense[i]}`)
    }
    lines.push('')
    lines.push('='.repeat(50))
    return lines.join('\n')
  }
}
