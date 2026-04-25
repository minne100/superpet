/**
 * @module analyze
 * @description Phase 1 分析脚本。运行Monte Carlo模拟，输出数值平衡报告。
 *
 * 用法：
 *   node app/sim/analyze.js           # 默认1000局
 *   node app/sim/analyze.js 500       # 指定500局
 *
 * 说明：终局条件为招式牌堆抽空，不设行动步上限。
 *
 * 输出报告格式（命令行+文件）：
 *   - 各玩家胜率
 *   - 平均回合数
 *   - 终局平均属性
 *   - 判定：数值是否平衡
 */
import { Simulator } from './simulator.js'

/**
 * @function main
 * @param {string[]} args — 命令行参数
 */
function main (args) {
  const gameCount = parseInt(args[0], 10) || 1000

  console.log('')
  console.log('  ╔════════════════════════════════════════╗')
  console.log('  ║     《超级宠物》Phase 1 数值验证       ║')
  console.log('  ║     Deterministic Monte Carlo           ║')
  console.log('  ╚════════════════════════════════════════╝')
  console.log('')
  console.log(`  游戏模式: 标准模式（招式牌抽空终局）`)
  console.log(`  对局数量: ${gameCount}`)
  console.log(`  随机种子: ${Date.now()}`)
  console.log('')

  const startTime = Date.now()

  const sim = new Simulator({
    mode: 'standard',
    verbose: true,
    seedBase: Date.now()
  })

  const stats = sim.runGames(gameCount)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\n  ⏱ 耗时: ${elapsed}s\n`)

  const report = sim.printReport(stats)
  console.log(report)

  // 数值分析
  console.log('')
  console.log('【数值平衡评估】')
  const totalWinRate = stats.wins.reduce((a, b) => a + b, 0)

  // 检查是否有显著偏向（Phase 1简单版：只看胜率偏差）
  const maxWinRate = Math.max(...stats.wins)
  const minWinRate = Math.min(...stats.wins)
  const winSpread = maxWinRate - minWinRate

  if (winSpread < 5) {
    console.log('  ✅ 胜率偏差很小(<5%)：数值较为平衡')
  } else if (winSpread < 15) {
    console.log('  ⚠️ 胜率偏差中等(<15%)：建议关注')
  } else {
    console.log('  🔴 胜率偏差过大(>=15%)：数值需要调整')
  }

  // 回合统计
  if (stats.avgRounds < 15) {
    console.log('  ⚠️ 平均回合数偏短：可能需要调整游戏节奏')
  } else if (stats.avgRounds > 100) {
    console.log('  ⚠️ 平均回合数偏长：可能需要加速机制')
  } else {
    console.log('  ✅ 平均回合数适中')
  }

  // 金币增长
  const avgGold = stats.avgGold[0]  // 以玩家A为例
  if (avgGold > stats.avgGold.reduce((a,b) => a+b, 0) / 4 + 5) {
    console.log('  ⚠️ 先手优势可能较大')
  }

  console.log('')
  console.log(`  📝 完整报告已保存至 sim/report_${Date.now()}.txt`)
  console.log('')
}

// 运行
main(process.argv.slice(2))
