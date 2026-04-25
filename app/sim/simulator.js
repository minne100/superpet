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
      // 最大回合数保护（防止游戏因为卡牌耗尽条件难以触发而无限运行）
      // 标准值：每局约40轮×4人=160回合，设500为安全上限
      maxTurns: config.maxTurns ?? 500
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

    // 分配初始起点
    const startPositions = engine.board.getStartPositions()
    engine.players.forEach((player, i) => {
      player.position = startPositions[i % startPositions.length]
      player.prevPosition = null
    })

    const bus = new GameBus()
    const playerIds = engine.players.map(p => p.id)

    // 创建4个 Agent 协程
    const agents = playerIds.map(id => new PlayerAgent(id, bus, engine))

    const result = new SimResult()
    result.gameIndex = gameIndex

    // Coordinator：游戏主循环（独立的 async 函数）
    const coordinatorDone = this.#runCoordinator(engine, bus, playerIds, result)

    // 同时启动：4个 Agent + 1个 Coordinator
    await Promise.all([
      coordinatorDone,
      ...agents.map(a => a.run())
    ])

    bus.clearWaiters()
    return result
  }

  /**
   * @method #runCoordinator
   * @private
   * @description 游戏协调器。驱动回合顺序，广播消息，检查终局。
   * 不做任何游戏决策，只负责流程控制。
   */
  async #runCoordinator (engine, bus, playerIds, result) {
    const COORD = '_coordinator'
    let turnCount = 0

    // 等所有 Agent 注册好 GAME_START waiter 后再广播
    await Promise.all(
      playerIds.map(id => bus.waitFor(COORD, m =>
        m.type === MSG.AGENT_READY && m.payload?.playerId === id
      ))
    )
    bus.broadcast(MSG.GAME_START, { state: engine.getState() })

    while (!engine.gameOver && turnCount < this.config.maxTurns) {
      const currentId = engine.turnManager.getCurrentPlayer()

      // 先注册 TURN_END 等待，再发 YOUR_TURN
      // 用 setImmediate 让出事件循环，确保 Agent 的 waitForTypes 已注册
      // （Agent 收到 GAME_START 或上轮 TURN_END resolve 后，
      //   需要一个 macrotask 才能执行到下一个 waitForTypes 注册）
      const turnEndPromise = bus.waitFor(COORD, m =>
        m.type === MSG.TURN_END && m.payload?.playerId === currentId
      )

      await new Promise(r => setImmediate(r))

      // 单播 YOUR_TURN（此时 Agent 已经注册好了 waitForTypes）
      bus.unicast(currentId, MSG.YOUR_TURN, { playerId: currentId })

      // 等待回合结束
      await turnEndPromise

      turnCount++
      result.diceRolls++

      // 推进引擎到下一回合
      engine.applyAction({ type: 'NEXT_TURN', playerId: currentId })
    }

    // 游戏结束，广播结果
    const finalResult = engine.getResult() || []
    bus.broadcast(MSG.GAME_OVER, { result: finalResult })

    // 填写结果
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
