/**
 * 弃牌重洗循环测试（规则书 §3.1 v2.0）
 * 覆盖：机遇/事件/内功卡牌堆耗尽后重洗循环；招式卡不重洗
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { GameEngine } from '../engine/game-engine.js'

/** 完成开局并返回引擎 */
function makeReadyEngine (seed = 42) {
  const engine = new GameEngine({ seed })
  engine.init()
  engine.rollForOrder()
  engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
  const starts = engine.board.getStartPositions()
  const posMap = {}
  engine.players.forEach((p, i) => { posMap[p.id] = starts[i % starts.length] })
  engine.assignStartPositions(posMap)
  return engine
}

describe('reshuffleDeck 弃牌重洗', () => {
  it('弃牌堆有牌时重洗成功，牌堆恢复', () => {
    const engine = makeReadyEngine()
    // 把5张内功卡移入弃牌堆，清空主牌堆
    const moved = engine.decks.neigong.splice(0, 5)
    engine.discardPiles.neigong.push(...moved)
    engine.decks.neigong = []

    const result = engine.reshuffleDeck('neigong')
    assert.strictEqual(result.reshuffled, true)
    assert.strictEqual(result.count, 5)
    assert.strictEqual(engine.decks.neigong.length, 5)
    assert.strictEqual(engine.discardPiles.neigong.length, 0)
  })

  it('弃牌堆也为空时，reshuffled 为 false', () => {
    const engine = makeReadyEngine()
    engine.decks.neigong = []
    engine.discardPiles.neigong = []
    const result = engine.reshuffleDeck('neigong')
    assert.strictEqual(result.reshuffled, false)
    assert.strictEqual(result.count, 0)
  })

  it('重洗后种子正确返回', () => {
    const engine = makeReadyEngine()
    engine.decks.opportunity = []
    engine.discardPiles.opportunity = engine.decks.opportunity.concat(
      [{ cardId: 'opportunity_001', type: 'opportunity' }]
    )
    engine.discardPiles.opportunity = [{ cardId: 'opportunity_001', type: 'opportunity' }]
    const result = engine.reshuffleDeck('opportunity')
    assert.ok(typeof result.seed === 'number')
    assert.ok(result.seed > 0)
  })

  it('传入自定义种子时使用该种子', () => {
    const engine = makeReadyEngine()
    engine.decks.event = []
    engine.discardPiles.event = [
      { cardId: 'event_001', type: 'event' },
      { cardId: 'event_002', type: 'event' }
    ]
    const r1 = engine.reshuffleDeck('event', 12345)
    assert.strictEqual(r1.seed, 12345)
    // 同种子重洗结果一致
    engine.decks.event = []
    engine.discardPiles.event = [
      { cardId: 'event_001', type: 'event' },
      { cardId: 'event_002', type: 'event' }
    ]
    const r2 = engine.reshuffleDeck('event', 12345)
    assert.deepStrictEqual(
      r1.count === r2.count,
      true,
      '相同种子重洗后牌数相同'
    )
  })
})

describe('内功卡循环使用', () => {
  it('内功牌堆抽空后自动重洗弃牌堆', () => {
    const engine = makeReadyEngine()
    // 清空内功主牌堆，放3张到弃牌堆
    engine.decks.neigong = []
    engine.discardPiles.neigong = [
      { cardId: 'neigong_001', type: 'neigong', steps: [{ stat: 'attack', value: 2 }] },
      { cardId: 'neigong_002', type: 'neigong', steps: [{ stat: 'attack', value: 2 }] },
      { cardId: 'neigong_003', type: 'neigong', steps: [{ stat: 'attack', value: 2 }] }
    ]

    // 玩家走到内功格 [2,4]，应触发重洗并抽到卡
    // 内功格 [2,4] 的邻接是 [1,4] 和 [3,4]，从 [1,4] 走1步到达
    const pid = engine.turnManager.getCurrentPlayer()
    const player = engine.getPlayer(pid)
    player.position = [1, 4]
    player.prevPosition = [0, 4]  // 来自上方

    const result = engine.applyAction({
      type: 'ADVANCE', playerId: pid,
      data: { steps: 1 }
    })

    const cellEvents = result.cellEvents || []
    const hasReshuffle = cellEvents.some(e => e.type === 'reshuffle' && e.deckType === 'neigong')
    const hasDraw = cellEvents.some(e => e.type === 'draw_neigong')
    assert.ok(hasReshuffle, '应触发内功牌堆重洗事件')
    assert.ok(hasDraw, '重洗后应成功抽到内功卡')
  })
})

describe('机遇/事件卡循环使用', () => {
  it('机遇卡执行后入弃牌堆', () => {
    const engine = makeReadyEngine()
    const initDiscard = engine.discardPiles.opportunity.length

    // 强制走到机遇格 [0,2]
    const pid = engine.turnManager.getCurrentPlayer()
    const player = engine.getPlayer(pid)
    player.position = [0, 1]
    player.prevPosition = [0, 0]

    engine.applyAction({ type: 'ADVANCE', playerId: pid, data: { steps: 1 } })

    // 机遇卡执行后应进入弃牌堆
    assert.ok(
      engine.discardPiles.opportunity.length > initDiscard,
      '机遇卡执行后应进入弃牌堆'
    )
  })

  it('事件卡执行后入弃牌堆', () => {
    const engine = makeReadyEngine()
    const initDiscard = engine.discardPiles.event.length

    // 强制走到事件格 [0,3]
    const pid = engine.turnManager.getCurrentPlayer()
    const player = engine.getPlayer(pid)
    player.position = [0, 2]
    player.prevPosition = [0, 1]

    engine.applyAction({ type: 'ADVANCE', playerId: pid, data: { steps: 1 } })

    assert.ok(
      engine.discardPiles.event.length > initDiscard,
      '事件卡执行后应进入弃牌堆'
    )
  })
})

describe('招式卡不循环', () => {
  it('招式牌堆抽空后不重洗，直接返回 null', () => {
    const engine = makeReadyEngine()
    engine.decks.move = []
    engine.discardPiles.move = [
      { cardId: 'move_001', type: 'move', range: [[-1, 1, 0]] }
    ]

    // 走到招式格 [0,7]，牌堆空时不重洗
    const pid = engine.turnManager.getCurrentPlayer()
    const player = engine.getPlayer(pid)
    player.position = [0, 6]
    player.prevPosition = [0, 5]

    const result = engine.applyAction({
      type: 'ADVANCE', playerId: pid,
      data: { steps: 1 }
    })

    const cellEvents = result.cellEvents || []
    const hasReshuffle = cellEvents.some(e => e.type === 'reshuffle')
    const hasDraw = cellEvents.some(e => e.type === 'draw_move')

    assert.strictEqual(hasReshuffle, false, '招式卡不应触发重洗')
    assert.strictEqual(hasDraw, false, '招式牌堆空时不应抽到卡')
    // 弃牌堆不动
    assert.strictEqual(engine.discardPiles.move.length, 1, '弃牌堆保持不变')
  })
})
