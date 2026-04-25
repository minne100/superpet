/**
 * 状态一致性测试（P2P核心校验）
 * 验证：同一seed + 同一action序列 → 所有引擎实例状态一致
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { GameEngine } from '../engine/game-engine.js'

/**
 * @function generateRandomActions
 * @param {number} count — 生成步数
 * @param {number} seed — 随机种子
 * @returns {Action[]}
 * @description 生成一串随机操作序列（模拟玩家自主决策）
 */
function generateRandomActions (count, seed) {
  const actions = []
  const rng = makeRng(seed)
  const types = ['ROLL_DICE', 'ADVANCE', 'NEXT_TURN', 'CONFIRM']
  const players = ['A', 'B', 'C', 'D']

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rng() * types.length)]
    const playerId = players[Math.floor(rng() * players.length)]
    const action = { type, playerId }

    if (type === 'ADVANCE') {
      action.data = { steps: Math.floor(rng() * 6) + 1 }
    }

    actions.push(action)
  }
  return actions
}

/**
 * @function makeRng
 * @param {number} seed
 * @returns {Function}
 */
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
    // 用ROLL_DICE + ADVANCE + NEXT_TURN模拟完整跑圈
    const seed = 54321
    const e1 = new GameEngine({ seed })
    const e2 = new GameEngine({ seed })
    e1.init()
    e2.init()

    const actions = [
      // 模拟A的一轮
      { type: 'ROLL_DICE', playerId: 'A' },
      { type: 'ADVANCE', playerId: 'A', data: { steps: 3 } },
      { type: 'NEXT_TURN', playerId: 'A' },
      // B的一轮
      { type: 'ROLL_DICE', playerId: 'B' },
      { type: 'ADVANCE', playerId: 'B', data: { steps: 5 } },
      { type: 'NEXT_TURN', playerId: 'B' },
      // C的一轮
      { type: 'ROLL_DICE', playerId: 'C' },
      { type: 'ADVANCE', playerId: 'C', data: { steps: 2 } },
      { type: 'NEXT_TURN', playerId: 'C' },
      // D的一轮
      { type: 'ROLL_DICE', playerId: 'D' },
      { type: 'ADVANCE', playerId: 'D', data: { steps: 4 } },
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

    // 验证所有玩家状态一致
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(s1.players[i].position, s2.players[i].position)
      assert.strictEqual(s1.players[i].gold, s2.players[i].gold)
      assert.strictEqual(s1.players[i].hand.move.length, s2.players[i].hand.move.length)
    }
  })

  it('大随机动作序列下两个引擎状态一致', () => {
    const seed = 99999
    const e1 = new GameEngine({ seed })
    const e2 = new GameEngine({ seed })
    e1.init()
    e2.init()

    const actions = generateRandomActions(50, 88888)

    for (const action of actions) {
      e1.applyAction(action)
      e2.applyAction(action)
    }

    const s1 = e1.getState()
    const s2 = e2.getState()

    // 核心状态验证
    assert.strictEqual(s1.round, s2.round)
    assert.strictEqual(s1.phase, s2.phase)
    assert.strictEqual(s1.gameOver, s2.gameOver)

    for (let i = 0; i < 4; i++) {
      assert.strictEqual(s1.players[i].position, s2.players[i].position,
        `玩家${s1.players[i].id}位置不一致`)
      assert.strictEqual(s1.players[i].gold, s2.players[i].gold,
        `玩家${s1.players[i].id}金币不一致`)
    }
  })

  it('空操作序列（仅init）状态一致', () => {
    const seed = 77777
    const e1 = new GameEngine({ seed })
    const e2 = new GameEngine({ seed })
    e1.init()
    e2.init()

    const s1 = e1.getState()
    const s2 = e2.getState()

    assert.deepStrictEqual(
      s1.players.map(p => ({ ...p, hand: { move: [p.hand.move.length], neigong: p.hand.neigong.length } })),
      s2.players.map(p => ({ ...p, hand: { move: [p.hand.move.length], neigong: p.hand.neigong.length } }))
    )
  })
})
