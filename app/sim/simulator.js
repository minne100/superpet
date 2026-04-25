/**
 * @class Simulator
 * @description Monte Carlo 模拟器。
 *
 * 职责：
 * 1. 运行完全自动化的对局（AI玩家）
 * 2. 跑1000+局收集统计数据
 * 3. 输出：胜率、招式使用率、金币分布、卡牌效率
 *
 * AI决策策略（简单版 Phase 1）：
 * - 骰子：自动roll
 * - 前进：骰子点数步
 * - 抽卡：全部保留
 * - 战斗：选择最便宜的招式
 * - 不使用卡牌策略（后续版本优化）
 */
import { GameEngine } from '../engine/game-engine.js'

/**
 * @class SimResult
 * @description 单局模拟结果
 */
class SimResult {
  constructor () {
    /** @type {number} 局数编号 */
    this.gameIndex = 0
    /** @type {number} 总回合数 */
    this.totalRounds = 0
    /** @type {string|null} 胜者ID */
    this.winner = null
    /** @type {Array} 最终排名 */
    this.rankings = []
    /** @type {number[]} 各玩家最终金币 */
    this.finalGold = []
    /** @type {number[]} 各玩家最终攻击 */
    this.finalAttack = []
    /** @type {number[]} 各玩家最终防御 */
    this.finalDefense = []
    /** @type {Object} 卡牌使用统计 { cardId: count } */
    this.cardUsage = {}
    /** @type {number} 投骰次数 */
    this.diceRolls = 0
    /** @type {number} 比武次数 */
    this.combatCount = 0
  }
}

/**
 * @class SimStats
 * @description 多局统计聚合
 */
class SimStats {
  constructor () {
    /** @type {number} 总对局数 */
    this.totalGames = 0
    /** @type {number[]} 各玩家胜场 */
    this.wins = [0, 0, 0, 0]
    /** @type {number[]} 各玩家平均排名 */
    this.avgRankings = []
    /** @type {number[]} 各玩家平均金币 */
    this.avgGold = []
    /** @type {number[]} 各玩家平均攻击 */
    this.avgAttack = []
    /** @type {number[]} 各玩家平均防御 */
    this.avgDefense = []
    /** @type {number} 平均回合数 */
    this.avgRounds = 0
    /** @type {number} 中位回合数 */
    this.medianRounds = 0
    /** @type {number} 最短对局回合数 */
    this.minRounds = Infinity
    /** @type {number} 最长对局回合数 */
    this.maxRounds = 0
    /** @type {Object[]} 卡牌效率排名 */
    this.cardEfficiency = []
    /** @type {Object} 币种分布 */
    this.goldDistribution = {}
  }
}

class Simulator {
  /**
   * @param {Object} config
   * @param {string} [config.mode='standard'] — 游戏模式
   * @param {boolean} [config.verbose=false] — 是否打印详情
   * @param {number} [config.seedBase=Date.now()] — 随机种子基值
   * @description 不设行动上限，终局条件由引擎自动检测（标准局=招式牌抽空）
   */
  constructor (config = {}) {
    this.config = {
      mode: config.mode || 'standard',
      verbose: config.verbose ?? false,
      seedBase: config.seedBase ?? Date.now()
    }
  }

  /**
   * @method runGames
   * @param {number} count — 对局数（如1000）
   * @returns {SimStats}
   * @description 运行count局模拟，返回聚合统计
   */
  runGames (count) {
    if (this.config.verbose) {
      console.log(`🔢 开始模拟 ${count} 局...`)
    }

    const results = []
    for (let i = 0; i < count; i++) {
      const result = this.runSingleGame(i)
      results.push(result)

      if (this.config.verbose && (i + 1) % 100 === 0) {
        const pct = (((i + 1) / count) * 100).toFixed(1)
        const winner = result.winner
        console.log(`  ${i + 1}/${count} (${pct}%) | 胜者: ${winner} | 回合: ${result.totalRounds}`)
      }
    }

    return this.#aggregateResults(results)
  }

  /**
   * @method runSingleGame
   * @param {number} gameIndex — 局编号
   * @returns {SimResult}
   * @description 运行一局完整的模拟对局
   */
  runSingleGame (gameIndex) {
    const seed = this.config.seedBase + gameIndex * 1000
    const engine = new GameEngine({ seed, mode: this.config.mode })
    engine.init()

    const result = new SimResult()
    result.gameIndex = gameIndex

    let turnCount = 0
    // 不设行动上限，终局条件由引擎自动检测（标准局=招式牌抽空）

    while (!engine.gameOver) {
      turnCount++

      const currentPlayer = engine.turnManager.getCurrentPlayer()

      // Step 1: 投骰（由引擎内部PRNG决定点数）
      // ROLL_DICE会让引擎消耗一次PRNG生成点数，但返回的数值我们不用
      // 因为引擎内#rollDice也会消耗一次PRNG
      const diceAction = engine.applyAction({ type: 'ROLL_DICE', playerId: currentPlayer })
      result.diceRolls++

      // Step 2: 用骰子结果前进
      engine.applyAction({
        type: 'ADVANCE',
        playerId: currentPlayer,
        data: { steps: diceAction.value }
      })

      // Step 3: 检查是否触发比武（TODO: Phase 2）
      // Step 4: 检查是否触发卡牌格（已由GameEngine内部处理）

      // Step 5: 结束回合（引擎内部自动检测终局）
      engine.applyAction({ type: 'NEXT_TURN', playerId: currentPlayer })
    }

    // 填结果
    result.totalRounds = engine.turnManager.round
    result.winner = engine.getPlayer(engine.turnManager.getCurrentPlayer())?.id || 'A'

    // 最终排名
    if (engine.gameOver) {
      result.rankings = engine.getResult() || []
    }

    // 最终状态
    for (const p of engine.players) {
      result.finalGold.push(p.gold)
      result.finalAttack.push(p.attack)
      result.finalDefense.push(p.defense)
    }


    return result
  }

  /**
   * @method #aggregateResults
   * @private
   * @param {SimResult[]} results — 对局结果列表
   * @returns {SimStats}
   * @description 聚合统计
   */
  #aggregateResults (results) {
    const stats = new SimStats()
    stats.totalGames = results.length

    const roundsList = []

    // 累加
    for (const r of results) {
      roundsList.push(r.totalRounds)

      if (r.rankings.length > 0) {
        for (const rankEntry of r.rankings) {
          const idx = ['A', 'B', 'C', 'D'].indexOf(rankEntry.id)
          if (idx >= 0 && rankEntry.rank === 1) {
            stats.wins[idx]++
          }
        }
      }

      // 追加重均
      if (stats.avgGold.length === 0) {
        stats.avgGold = r.finalGold.map(v => v)
        stats.avgAttack = r.finalAttack.map(v => v)
        stats.avgDefense = r.finalDefense.map(v => v)
      } else {
        for (let i = 0; i < r.finalGold.length; i++) {
          stats.avgGold[i] += r.finalGold[i]
        }
        for (let i = 0; i < r.finalAttack.length; i++) {
          stats.avgAttack[i] += r.finalAttack[i]
        }
        for (let i = 0; i < r.finalDefense.length; i++) {
          stats.avgDefense[i] += r.finalDefense[i]
        }
      }
    }

    // 求平均
    const n = results.length
    stats.avgGold = stats.avgGold.map(v => +(v / n).toFixed(2))
    stats.avgAttack = stats.avgAttack.map(v => +(v / n).toFixed(2))
    stats.avgDefense = stats.avgDefense.map(v => +(v / n).toFixed(2))

    // 回合统计
    roundsList.sort((a, b) => a - b)
    stats.avgRounds = +(roundsList.reduce((a, b) => a + b, 0) / n).toFixed(2)
    stats.minRounds = roundsList[0]
    stats.maxRounds = roundsList[roundsList.length - 1]
    stats.medianRounds = roundsList[Math.floor(roundsList.length / 2)]

    // 胜率百分比
    stats.wins = stats.wins.map(w => +(w / n * 100).toFixed(2))

    return stats
  }

  /**
   * @method printReport
   * @param {SimStats} stats — 聚合统计
   * @returns {string}
   * @description 生成可读报告文本
   */
  printReport (stats) {
    const lines = []
    lines.push('='.repeat(50))
    lines.push(`  《超级宠物》Phase 1 数值模拟报告`)
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

export { Simulator, SimResult, SimStats }
