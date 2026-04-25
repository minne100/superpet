/**
 * replay.js — 运行一局完整游戏并输出所有步骤
 *
 * 用法：
 *   node --experimental-vm-modules app/sim/replay.js
 *   或（如果 package.json type=module）：
 *   node app/sim/replay.js [seed] [maxTurns]
 *
 * 示例：
 *   node app/sim/replay.js 42 200
 */

import { Simulator } from './simulator.js'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const seed     = parseInt(process.argv[2]) || 42
const maxTurns = parseInt(process.argv[3]) || 300

console.log(`\n运行一局游戏（seed=${seed}, maxTurns=${maxTurns}）...\n`)

const sim = new Simulator({
  seedBase: seed,
  trace: true,
  maxTurns
})

const result = await sim.runSingleGame(0)

// 保存 log 到 log/ 目录
const __dirname = dirname(fileURLToPath(import.meta.url))
const logDir = resolve(__dirname, '../../log')
mkdirSync(logDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const logFile = resolve(logDir, `replay_seed${seed}_${timestamp}.txt`)
writeFileSync(logFile, result.log, 'utf-8')

console.log(result.log)
console.log(`\n📈 本局统计：`)
console.log(`   总回合数：${result.totalRounds}`)
console.log(`   总行动数：${result.diceRolls}`)
console.log(`   胜者：${result.winner}`)
console.log(`\n💾 日志已保存：${logFile}`)
