/**
 * 状态一致性测试（P2P核心校验）
 * 验证：同一seed + 同一action序列 → 所有引擎实例状态一致
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { GameEngine } from '../engine/game-engine.js'

/** 完成开局流程的辅助函数（避免各测试重复） */
function completeSetup (engine) {
  engine.rollForOrder()
  engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
  const starts = engine.board.getStartPositions()
  const posMap = {}
  engine.players.forEach((p, i) => { posMap[p.id] = starts[i % starts.length] })
  engine.assignStartPositions(posMap)
}

function makeRng (seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('P2P 状态一致性', () => {
  it('同一seed下两个引擎实例全部一致：RUN模式', () => {
    const seed = 54321
    const e1 = new GameEngine({ seed })
    const e2 = new GameEngine({ seed })
    e1.init(); completeSetup(e1)
    e2.init(); completeSetup(e2)

    const actions = [
      { type: 'ROLL_DICE', playerId: 'A' },
      { type: 'ADVANCE',   playerId: 'A', data: { steps: 3 } },
      { type: 'NEXT_TURN', playerId: 'A' },
      { type: 'ROLL_DICE', playerId: 'B' },
      { type: 'ADVANCE',   playerId: 'B', data: { steps: 5 } },
      { type: 'NEXT_TURN', playerId: 'B' },
      { type: 'ROLL_DICE', playerId: 'C' },
      { type: 'ADVANCE',   playerId: 'C', data: { steps: 2 } },
      { type: 'NEXT_TURN', playerId: 'C' },
      { type: 'ROLL_DICE', playerId: 'D' },
      { type: 'ADVANCE',   playerId: 'D', data: { steps: 4 } },
      { type: 'NEXT_TURN', playerId: 'D' }
    ]

    for (const action of actions) {
      e1.applyAction(action)
      e2.applyAction(action)
    }

    const s1 = e1.getState()
    const s2 = e2.getState()

    assert.strictEqual(s1.phase, s2.phase)
    assert.strictEqual(s1.round, s2.round)
    assert.strictEqual(s1.currentPlayer, s2.currentPlayer)

    for (let i = 0; i < 4; i++) {
      assert.deepStrictEqual(s1.players[i].position, s2.players[i].position,
        `玩家${s1.players[i].id}位置不一致`)
      assert.strictEqual(s1.players[i].gold, s2.players[i].gold,
        `玩家${s1.players[i].id}金币不一致`)
      assert.strictEqual(s1.players[i].hand.move.length, s2.players[i].hand.move.length)
    }
  })

  it('大随机动作序列下两个引擎状态一致', () => {
    const seed = 99999
    const e1 = new GameEngine({ seed })
    const e2 = new GameEngine({ seed })
    e1.init(); completeSetup(e1)
    e2.init(); completeSetup(e2)

    // 生成合法的跑圈动作序列
    const rng = makeRng(88888)
    const playerIds = e1.turnManager.order
    const actions = []
    for (let i = 0; i < 20; i++) {
      const pid = playerIds[i % playerIds.length]
      const steps = Math.floor(rng() * 6) + 1
      actions.push({ type: 'ROLL_DICE', playerId: pid })
      actions.push({ type: 'ADVANCE',   playerId: pid, data: { steps } })
      actions.push({ type: 'NEXT_TURN', playerId: pid })
    }

    for (const action of actions) {
      e1.applyAction(action)
      e2.applyAction(action)
    }

    const s1 = e1.getState()
    const s2 = e2.getState()

    assert.strictEqual(s1.round,    s2.round)
    assert.strictEqual(s1.phase,    s2.phase)
    assert.strictEqual(s1.gameOver, s2.gameOver)

    for (let i = 0; i < 4; i++) {
      assert.deepStrictEqual(s1.players[i].position, s2.players[i].position,
        `玩家${s1.players[i].id}位置不一致`)
      assert.strictEqual(s1.players[i].gold, s2.players[i].gold,
        `玩家${s1.players[i].id}金币不一致`)
    }
  })

  it('空操作序列（仅init+setup）状态一致', () => {
    const seed = 77777
    const e1 = new GameEngine({ seed })
    const e2 = new GameEngine({ seed })
    e1.init(); completeSetup(e1)
    e2.init(); completeSetup(e2)

    const s1 = e1.getState()
    const s2 = e2.getState()

    assert.strictEqual(s1.phase, s2.phase)
    assert.strictEqual(s1.phase, 'run')
    for (let i = 0; i < 4; i++) {
      assert.deepStrictEqual(s1.players[i].position, s2.players[i].position)
      assert.strictEqual(s1.players[i].gold, s2.players[i].gold)
    }
  })
})
