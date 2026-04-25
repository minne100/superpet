/**
 * Player 类单元测试
 * 测试：初始化、手牌操作、属性操作、比武属性
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Player } from '../engine/player.js'

describe('Player 初始化', () => {
  it('应使用默认值初始化新玩家', () => {
    const p = new Player({ id: 'A' })
    assert.strictEqual(p.id, 'A')
    assert.strictEqual(p.name, '')
    assert.strictEqual(p.talent, null)
    assert.strictEqual(p.gold, 5)
    assert.strictEqual(p.attack, 1)
    assert.strictEqual(p.defense, 1)
    assert.strictEqual(p.position, null)  // 田字格：初始为null，开局时选择休整格后赋值
    assert.strictEqual(p.alive, true)
    assert.strictEqual(p.skipNextTurn, false)
    assert.strictEqual(p.inCombat, false)
    assert.strictEqual(p.combatPos, null)
    assert.strictEqual(p.countCards(), 0)
  })

  it('应正确设置宠物名称和天赋', () => {
    const p = new Player({ id: 'A', name: '猫', talent: '速跑' })
    assert.strictEqual(p.name, '猫')
    assert.strictEqual(p.talent, '速跑')
  })
})

describe('Player 手牌操作', () => {
  it('应能添加招式卡', () => {
    const p = new Player({ id: 'A' })
    const card = { cardId: 'move_001', type: 'move' }
    p.addCard('move', card)
    assert.strictEqual(p.countCards('move'), 1)
    assert.strictEqual(p.countCards(), 1)
  })

  it('应能添加内功卡', () => {
    const p = new Player({ id: 'A' })
    const card = { cardId: 'neigong_005', type: 'neigong' }
    p.addCard('neigong', card)
    assert.strictEqual(p.countCards('neigong'), 1)
    assert.strictEqual(p.countCards(), 1)
  })

  it('应能按索引移除手牌', () => {
    const p = new Player({ id: 'A' })
    p.addCard('move', { cardId: 'move_001' })
    p.addCard('move', { cardId: 'move_007' })
    const removed = p.removeCard('move', 0)
    assert.strictEqual(removed.cardId, 'move_001')
    assert.strictEqual(p.countCards('move'), 1)
  })

  it('应能按cardId移除手牌', () => {
    const p = new Player({ id: 'A' })
    p.addCard('move', { cardId: 'move_003' })
    const removed = p.removeCard('move', 'move_003')
    assert.strictEqual(removed.cardId, 'move_003')
    assert.strictEqual(p.countCards('move'), 0)
  })

  it('移除不存在的卡牌应返回null', () => {
    const p = new Player({ id: 'A' })
    assert.strictEqual(p.removeCard('move', 'move_999'), null)
  })

  it('hasCardType 应正确判断', () => {
    const p = new Player({ id: 'A' })
    assert.strictEqual(p.hasCardType('move'), false)
    p.addCard('move', { cardId: 'move_001' })
    assert.strictEqual(p.hasCardType('move'), true)
    assert.strictEqual(p.hasCardType('neigong'), false)
  })

  it('传入非法卡牌类型应抛错', () => {
    const p = new Player({ id: 'A' })
    assert.throws(() => p.addCard('invalid', {}), /未知卡牌类型/)
    assert.throws(() => p.removeCard('invalid', 0), /未知卡牌类型/)
  })
})

describe('Player 属性操作', () => {
  it('金币增加应正确累加', () => {
    const p = new Player({ id: 'A' })
    p.addGold(3)
    assert.strictEqual(p.gold, 8)
  })

  it('金币扣除不应低于0', () => {
    const p = new Player({ id: 'A' })
    const actual = p.removeGold(10)
    assert.strictEqual(actual, 5) // 只有5，全扣完
    assert.strictEqual(p.gold, 0)
  })

  it('金币扣除应返回实际扣了多少', () => {
    const p = new Player({ id: 'A' })
    const actual = p.removeGold(3)
    assert.strictEqual(actual, 3)
    assert.strictEqual(p.gold, 2)
  })

  it('攻击力和防御力不应低于0', () => {
    const p = new Player({ id: 'A' })
    p.modifyAttack(-5)
    p.modifyDefense(-5)
    assert.strictEqual(p.attack, 0)
    assert.strictEqual(p.defense, 0)
  })
})

describe('Player 比武属性', () => {
  it('比武总攻击应包含基础+临战', () => {
    const p = new Player({ id: 'A', name: '狗' })
    p.modifyAttack(3) // 基础变为4
    p.combatAtkBuff = 2
    assert.strictEqual(p.getCombatAttack(), 6)
  })

  it('比武总防御应包含基础+临战', () => {
    const p = new Player({ id: 'A' })
    p.modifyDefense(2) // 基础变为3
    p.combatDefBuff = 5
    assert.strictEqual(p.getCombatDefense(), 8)
  })
})

describe('Player toJSON', () => {
  it('应返回纯数据对象', () => {
    const p = new Player({ id: 'A', name: '兔', talent: '厚皮' })
    p.addCard('move', { cardId: 'move_005' })
    const json = p.toJSON()
    assert.strictEqual(json.id, 'A')
    assert.strictEqual(json.name, '兔')
    assert.strictEqual(json.talent, '厚皮')
    assert.strictEqual(json.hand.move.length, 1)
    // 验证是副本不是引用
    json.hand.move = []
    assert.strictEqual(p.hand.move.length, 1)
  })
})
