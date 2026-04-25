/**
 * TurnManager 单元测试
 * 测试：初始化/回合推进/跳回合/轮次完成/阶段切换
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { TurnManager } from '../engine/turn-manager.js'

describe('TurnManager 初始化', () => {
  it('应使用传入的顺序初始化', () => {
    const tm = new TurnManager({ order: ['A', 'B', 'C', 'D'] })
    assert.deepStrictEqual(tm.order, ['A', 'B', 'C', 'D'])
    assert.strictEqual(tm.currentIndex, 0)
    assert.strictEqual(tm.round, 1)
    assert.strictEqual(tm.phase, 'run')
  })

  it('init方法应重置全部状态', () => {
    const tm = new TurnManager({ order: ['A', 'B'] })
    tm.round = 5
    tm.currentIndex = 1
    tm.setPhase('combat')
    tm.init(['D', 'C', 'B', 'A'])
    assert.strictEqual(tm.round, 1)
    assert.strictEqual(tm.currentIndex, 0)
    assert.strictEqual(tm.phase, 'run')
    assert.deepStrictEqual(tm.order, ['D', 'C', 'B', 'A'])
  })
})

describe('TurnManager 回合推进', () => {
  it('getCurrentPlayer应返回当前玩家', () => {
    const tm = new TurnManager({ order: ['A', 'B', 'C', 'D'] })
    assert.strictEqual(tm.getCurrentPlayer(), 'A')
    tm.nextTurn()
    assert.strictEqual(tm.getCurrentPlayer(), 'B')
  })

  it('nextTurn应循环推进', () => {
    const tm = new TurnManager({ order: ['A', 'B', 'C'] })
    tm.nextTurn()
    tm.nextTurn()
    const result = tm.nextTurn()
    assert.strictEqual(result.playerId, 'A') // 回到开头
  })

  it('nextTurn不应跳过无效果的玩家', () => {
    const tm = new TurnManager({ order: ['A', 'B'] })
    const result = tm.nextTurn(() => false) // 不跳过任何人
    assert.strictEqual(result.playerId, 'B')
    assert.strictEqual(result.skipped, false)
  })

  it('nextTurn应跳过shouldSkipFn返回true的玩家', () => {
    const tm = new TurnManager({ order: ['A', 'B', 'C'] })
    // B被跳过
    const result = tm.nextTurn((id) => id === 'B')
    assert.strictEqual(result.playerId, 'C')
    // 注意：被跳过者的玩家不会轮到，直接到下一个
  })
})

describe('TurnManager 轮次', () => {
  it('nextTurn自动检测轮次完成', () => {
    const tm = new TurnManager({ order: ['A', 'B', 'C', 'D'] })
    // A→B(1)→C(2)→D(3)→A: 4次后回到A，完成第一轮
    const r1 = tm.nextTurn() // B
    const r2 = tm.nextTurn() // C
    const r3 = tm.nextTurn() // D
    const r4 = tm.nextTurn() // A
    assert.strictEqual(r1.newRound, false)
    assert.strictEqual(r2.newRound, false)
    assert.strictEqual(r3.newRound, false)
    assert.strictEqual(r4.newRound, true)
    assert.strictEqual(tm.round, 2)
    assert.strictEqual(tm.actedThisRound, 0)
  })

  it('advanceRound应递增轮数并重置', () => {
    const tm = new TurnManager({ order: ['A', 'B', 'C'] })
    // 推进到满
    for (let i = 0; i < 2; i++) tm.nextTurn()
    tm.advanceRound()
    assert.strictEqual(tm.round, 2)
    assert.strictEqual(tm.currentIndex, 0)
    assert.strictEqual(tm.actedThisRound, 0)
  })
})

describe('TurnManager 阶段切换', () => {
  it('setPhase应正确切换阶段', () => {
    const tm = new TurnManager({ order: ['A', 'B'] })
    tm.setPhase('combat')
    assert.strictEqual(tm.phase, 'combat')
    tm.setPhase('settlement')
    assert.strictEqual(tm.phase, 'settlement')
    tm.setPhase('run')
    assert.strictEqual(tm.phase, 'run')
  })
})

describe('TurnManager toJSON', () => {
  it('应序列化为纯对象', () => {
    const tm = new TurnManager({ order: ['A', 'B'] })
    const json = tm.toJSON()
    assert.strictEqual(json.round, 1)
    assert.strictEqual(json.phase, 'run')
    assert.strictEqual(json.actedThisRound, 0)
    assert.deepStrictEqual(json.order, ['A', 'B'])
  })
})
