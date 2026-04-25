/**
 * EffectManager 单元测试
 * 测试：添加/查询/消耗/轮次递减/清除/列表
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { EffectManager } from '../engine/effect-manager.js'

describe('EffectManager 添加和查询', () => {
  it('添加效果后应能查询到', () => {
    const em = new EffectManager()
    em.add('A', 'skip_turn', 1, { source: 'opportunity_008' })
    assert.strictEqual(em.get('A', 'skip_turn'), true)
  })

  it('未添加效果的玩家返回false', () => {
    const em = new EffectManager()
    assert.strictEqual(em.get('B', 'skip_turn'), false)
  })

  it('getFirst应返回效果的meta', () => {
    const em = new EffectManager()
    em.add('A', 'dice_x2', 2, { source: 'event_010' })
    const effect = em.getFirst('A', 'dice_x2')
    assert.strictEqual(effect.source, 'event_010')
    assert.strictEqual(effect.rounds, 2)
  })
})

describe('EffectManager 消耗', () => {
  it('use应移除一次性效果', () => {
    const em = new EffectManager()
    em.add('A', 'redraw_once', 1)
    assert.strictEqual(em.get('A', 'redraw_once'), true)
    em.use('A', 'redraw_once')
    assert.strictEqual(em.get('A', 'redraw_once'), false)
  })

  it('use不存在的效果应返回false', () => {
    const em = new EffectManager()
    assert.strictEqual(em.use('A', 'nonexistent'), false)
  })

  it('use后不应影响其他效果', () => {
    const em = new EffectManager()
    em.add('A', 'skip_turn', 2)
    em.add('A', 'dice_x2', 1)
    em.use('A', 'skip_turn')
    assert.strictEqual(em.get('A', 'skip_turn'), false)
    assert.strictEqual(em.get('A', 'dice_x2'), true)
  })
})

describe('EffectManager 轮次递减', () => {
  it('tick后轮次减1，到期自动清除', () => {
    const em = new EffectManager()
    em.add('A', 'skip_turn', 2)
    em.tick('A', 'skip_turn')
    assert.strictEqual(em.get('A', 'skip_turn'), true) // 还剩1轮
    em.tick('A', 'skip_turn')
    assert.strictEqual(em.get('A', 'skip_turn'), false) // 到期清除
  })

  it('tickAll应递减所有玩家的所有效果', () => {
    const em = new EffectManager()
    em.add('A', 'dice_x2', 1)
    em.add('B', 'skip_turn', 2)
    em.tickAll()
    assert.strictEqual(em.get('A', 'dice_x2'), false) // 到期
    assert.strictEqual(em.get('B', 'skip_turn'), true) // 还剩1轮
    em.tickAll()
    assert.strictEqual(em.get('B', 'skip_turn'), false) // 到期
  })

  it('rounds=-1的效果永不过期', () => {
    const em = new EffectManager()
    em.add('A', 'cultivation_x2', -1)
    for (let i = 0; i < 10; i++) {
      em.tick('A', 'cultivation_x2')
    }
    assert.strictEqual(em.get('A', 'cultivation_x2'), true)
  })
})

describe('EffectManager 清除', () => {
  it('clear应移除指定效果', () => {
    const em = new EffectManager()
    em.add('A', 'skip_turn', 3)
    em.add('A', 'dice_x2', 1)
    em.clear('A', 'skip_turn')
    assert.strictEqual(em.get('A', 'skip_turn'), false)
    assert.strictEqual(em.get('A', 'dice_x2'), true)
  })

  it('clearAll应移除玩家所有效果', () => {
    const em = new EffectManager()
    em.add('A', 'skip_turn', 1)
    em.add('A', 'dice_half', 2)
    em.add('B', 'dice_x2', 3)
    em.clearAll('A')
    assert.strictEqual(em.get('A', 'skip_turn'), false)
    assert.strictEqual(em.get('A', 'dice_half'), false)
    assert.strictEqual(em.get('B', 'dice_x2'), true) // B不受影响
  })
})

describe('EffectManager 列表', () => {
  it('list应返回当前所有效果副本', () => {
    const em = new EffectManager()
    em.add('A', 'skip_turn', 2)
    em.add('A', 'dice_x2', 1)
    const effects = em.list('A')
    assert.strictEqual(effects.length, 2)
    // 验证是副本
    effects.pop()
    assert.strictEqual(em.list('A').length, 2)
  })

  it('无效果的玩家返回空数组', () => {
    const em = new EffectManager()
    assert.deepStrictEqual(em.list('Z'), [])
  })
})

describe('EffectManager toJSON', () => {
  it('应序列化为纯对象', () => {
    const em = new EffectManager()
    em.add('A', 'skip_turn', 1, { source: 'test' })
    const json = em.toJSON()
    assert.ok(json.A)
    assert.strictEqual(json.A.length, 1)
    assert.strictEqual(json.A[0].name, 'skip_turn')
  })
})
