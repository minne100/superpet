/**
 * CardInterpreter 单元测试
 * 测试：用实际卡牌JSON验证解释器正确解析和执行
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { CardInterpreter } from '../engine/card-interpreter.js'
import { loadCard } from '../engine/load-cards.js'

describe('CardInterpreter 基础', () => {
  it('无steps的卡牌（招式卡）应直接完成', () => {
    const ci = new CardInterpreter()
    const card = loadCard('move_001')
    const result = ci.interpret(card, { triggerPlayerId: 'A' })
    assert.strictEqual(result.complete, true)
  })

  it('无steps的卡牌（内功卡）应直接完成', () => {
    const ci = new CardInterpreter()
    const card = loadCard('neigong_001')
    const result = ci.interpret(card, { triggerPlayerId: 'A' })
    assert.strictEqual(result.complete, true)
  })
})

describe('CardInterpreter 机遇卡（简单卡牌）', () => {
  it('机会#001: draw_card (抽招式卡) → 内部运算，直接完成', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_001')
    const result = ci.interpret(card, { triggerPlayerId: 'A', playerOrder: ['A','B','C','D'] })
    // draw_card没有分角色（role: all），所以直接完成
    assert.strictEqual(result.complete, true)
  })

  it('机会#003: roll_dice + add_gold → 有waitFor', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_003')
    const result = ci.interpret(card, {
      triggerPlayerId: 'A',
      playerOrder: ['A', 'B', 'C', 'D']
    })
    // 当前节点是actor，第1步roll_dice需要输入
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.waitFor, 'roll_dice')
  })

  it('机会#008: debuff → 内部运算，直接完成', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_008')
    const result = ci.interpret(card, { triggerPlayerId: 'A' })
    assert.strictEqual(result.complete, true)
  })
})

describe('CardInterpreter 事件卡（复杂卡牌）', () => {
  it('事件#001: loop(roll_dice) → calc → debuff', () => {
    const ci = new CardInterpreter()
    const card = loadCard('event_001')
    const result = ci.interpret(card, {
      triggerPlayerId: 'A',
      playerOrder: ['A', 'B', 'C', 'D']
    })
    // 模拟器模式下本节点是actor，loop的第1个step有roll_dice需要输入
    assert.strictEqual(result.waitFor, 'roll_dice')
  })

  it('事件#003: loop(roll) → calc → has_cards? → pick → transfer', () => {
    const ci = new CardInterpreter()
    const card = loadCard('event_003')
    const result = ci.interpret(card, {
      triggerPlayerId: 'A',
      playerOrder: ['A', 'B', 'C', 'D']
    })
    assert.strictEqual(result.waitFor, 'roll_dice')
  })

  it('事件#004: has_cards? → reveal_and_pick → transfer_card → discard', () => {
    const ci = new CardInterpreter()
    const card = loadCard('event_004')
    const result = ci.interpret(card, {
      triggerPlayerId: 'A',
      playerOrder: ['A', 'B', 'C', 'D']
    })
    // has_cards? 是内部运算，直接过
    // 但下个step可能用到pick
    assert.ok(result.complete || result.waitFor !== null)
  })

  it('事件#007: loop(roll_dice) → loop(remove_gold)', () => {
    const ci = new CardInterpreter()
    const card = loadCard('event_007')
    const result = ci.interpret(card, {
      triggerPlayerId: 'A',
      playerOrder: ['A', 'B', 'C', 'D']
    })
    assert.strictEqual(result.waitFor, 'roll_dice')
  })
})

describe('CardInterpreter 加载所有卡牌不抛错', () => {
  it('所有事件卡(001~030)可以加载', () => {
    for (let i = 1; i <= 30; i++) {
      const id = `event_${String(i).padStart(3, '0')}`
      const card = loadCard(id)
      assert.strictEqual(card.type, 'event')
    }
  })

  it('所有机遇卡(001~030)可以加载', () => {
    for (let i = 1; i <= 30; i++) {
      const id = `opportunity_${String(i).padStart(3, '0')}`
      const card = loadCard(id)
      assert.strictEqual(card.type, 'opportunity')
    }
  })

  it('所有招式卡(001~030)可以加载', () => {
    for (let i = 1; i <= 30; i++) {
      const id = `move_${String(i).padStart(3, '0')}`
      const card = loadCard(id)
      assert.strictEqual(card.type, 'move')
    }
  })

  it('所有内功卡(001~030)可以加载', () => {
    for (let i = 1; i <= 30; i++) {
      const id = `neigong_${String(i).padStart(3, '0')}`
      const card = loadCard(id)
      assert.strictEqual(card.type, 'neigong')
    }
  })
})

describe('CardInterpreter 连续执行', () => {
  it('多次interpret应重置状态', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_001')
    ci.interpret(card, { triggerPlayerId: 'B' })
    ci.interpret(card, { triggerPlayerId: 'A' })
    assert.strictEqual(ci.context.triggerPlayerId, 'A')
  })

  it('简单卡牌连续调用不抛错', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_008')
    ci.interpret(card, { triggerPlayerId: 'A' })
    ci.interpret(card, { triggerPlayerId: 'B' })
    ci.interpret(card, { triggerPlayerId: 'C' })
    assert.strictEqual(ci.card.cardId, 'opportunity_008')
  })
})
