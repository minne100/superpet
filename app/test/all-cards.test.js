/**
 * 所有机遇卡和事件卡的功能测试
 * 验证每个卡牌都能正确加载和执行
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { CardInterpreter } from '../engine/card-interpreter.js'
import { loadCard } from '../engine/load-cards.js'

// 模拟引擎上下文
const mockEngine = {
  getPlayer: (id) => ({
    id,
    name: `Player${id}`,
    gold: 100,
    attack: 1,
    defense: 1,
    moveCards: [],
    neigongCards: [],
    hand: {
      move: [],
      neigong: []
    },
    addGold: (amount) => {},
    removeGold: (amount) => {},
    modifyAttack: (amount) => {},
    modifyDefense: (amount) => {},
    addCard: (type, card) => {},
    removeCard: (type, cardId) => {}
  }),
  effectManager: {
    add: (playerId, effect, rounds, meta) => {},
    get: (playerId, effect) => false,
    clear: (playerId, effect) => {}
  },
  decks: {
    move: [],
    neigong: []
  },
  board: {
    getTotalCells: () => 32
  }
}

// 基础上下文
const baseContext = {
  triggerPlayerId: 'A',
  playerOrder: ['A', 'B', 'C', 'D'],
  engine: mockEngine
}

// 测试所有机遇卡
describe('所有机遇卡功能测试', () => {
  for (let i = 1; i <= 30; i++) {
    const cardId = `opportunity_${String(i).padStart(3, '0')}`
    
    it(`${cardId} 应能正确加载和执行`, () => {
      const ci = new CardInterpreter()
      const card = loadCard(cardId)
      assert.strictEqual(card.type, 'opportunity')
      
      // 执行卡牌
      const result = ci.interpret(card, baseContext)
      
      // 卡牌执行不应抛出错误
      assert.ok(result)
      assert.strictEqual(typeof result.complete, 'boolean')
    })
  }
})

// 测试所有事件卡
describe('所有事件卡功能测试', () => {
  for (let i = 1; i <= 30; i++) {
    const cardId = `event_${String(i).padStart(3, '0')}`
    
    it(`${cardId} 应能正确加载和执行`, () => {
      const ci = new CardInterpreter()
      const card = loadCard(cardId)
      assert.strictEqual(card.type, 'event')
      
      // 执行卡牌
      const result = ci.interpret(card, baseContext)
      
      // 卡牌执行不应抛出错误
      assert.ok(result)
      assert.strictEqual(typeof result.complete, 'boolean')
    })
  }
})

// 测试特定卡牌的功能
describe('特定卡牌功能测试', () => {
  it('opportunity_006: 选择丢弃1张招式卡（无则忽略）', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_006')
    
    // 测试有招式卡的情况
    const contextWithCards = {
      ...baseContext,
      engine: {
        ...mockEngine,
        getPlayer: (id) => ({
          ...mockEngine.getPlayer(id),
          moveCards: [{ id: 'move_001', name: '测试招式卡' }],
          hand: {
            move: [{ id: 'move_001', name: '测试招式卡' }],
            neigong: []
          }
        })
      }
    }
    
    const result = ci.interpret(card, contextWithCards)
    assert.ok(result)
  })
  
  it('opportunity_008: 下一轮轮空（debuff with skip_turn）', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_008')
    
    // 记录effectManager.add的调用
    let addCalled = false
    let addParams = null
    
    const contextWithEffect = {
      ...baseContext,
      engine: {
        ...mockEngine,
        effectManager: {
          ...mockEngine.effectManager,
          add: (playerId, effect, rounds, meta) => {
            addCalled = true
            addParams = { playerId, effect, rounds, meta }
          }
        }
      }
    }
    
    const result = ci.interpret(card, contextWithEffect)
    assert.strictEqual(result.complete, true)
    assert.ok(addCalled, 'should call effectManager.add for skip_turn')
    assert.strictEqual(addParams.effect, 'skip_turn')
    assert.strictEqual(addParams.rounds, 1)
  })
  
  it('opportunity_011: 随机丢弃1张内功卡（无则忽略）', () => {
    const ci = new CardInterpreter()
    const card = loadCard('opportunity_011')
    
    // 测试有内功卡的情况
    const contextWithCards = {
      ...baseContext,
      engine: {
        ...mockEngine,
        getPlayer: (id) => ({
          ...mockEngine.getPlayer(id),
          neigongCards: [{ id: 'neigong_001', name: '测试内功卡' }],
          hand: {
            move: [],
            neigong: [{ id: 'neigong_001', name: '测试内功卡' }]
          }
        })
      }
    }
    
    const result = ci.interpret(card, contextWithCards)
    assert.ok(result)
  })
  
  it('event_001: 轮空效果（debuff with skip_turn）', () => {
    const ci = new CardInterpreter()
    const card = loadCard('event_001')
    
    const result = ci.interpret(card, baseContext)
    assert.ok(result)
  })
})
