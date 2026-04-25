/**
 * BattleBoard 和 CombatSystem 单元测试
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { BattleBoard, ALL_COORDS, getAdjacent, getHexId, DIRS } from '../engine/battle-board.js'
import { CombatSystem } from '../engine/combat-system.js'

describe('BattleBoard 37格六边形对战盘', () => {
  it('总格数应为37', () => {
    assert.strictEqual(ALL_COORDS.length, 37)
  })

  it('00号为中心格 [0,0,0]', () => {
    assert.deepStrictEqual(ALL_COORDS[0], [0, 0, 0])
  })

  it('相邻格子曼哈顿距离应为2', () => {
    const adj = getAdjacent(0)
    assert.ok(adj.length > 0, '中心格应有相邻格子')
    assert.ok(adj.every(id => id >= 1 && id <= 6), '中心格相邻应为01-06')
  })

  it('getHexId应根据坐标返回正确ID', () => {
    assert.strictEqual(getHexId(0, 0, 0), 0)
    assert.strictEqual(getHexId(1, 0, -1), 1)
    assert.strictEqual(getHexId(1, -1, 0), 6)
  })
})

describe('CombatSystem 完整比武流程', () => {
  it('startBattle应设置正确的出手顺序', () => {
    const cs = new CombatSystem()
    const result = cs.startBattle(['A', 'B', 'C', 'D'])
    assert.strictEqual(result.order.length, 4)
    assert.ok(result.order.includes('A'))
    assert.ok(result.order.includes('B'))
    assert.ok(result.order.includes('C'))
    assert.ok(result.order.includes('D'))
  })

  it('初始位置应分配正确', () => {
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B', 'C', 'D'])
    assert.ok(cs.battleState['A'].pos !== undefined)
    assert.ok(cs.battleState['B'].pos !== undefined)
  })

  it('临战属性应复制永久属性', () => {
    const mockPlayers = {
      'A': { id: 'A', attack: 5, defense: 3, gold: 10, hand: { move: [] } },
      'B': { id: 'B', attack: 3, defense: 5, gold: 10, hand: { move: [] } }
    }
    const mockEngine = {
      getPlayer: (id) => mockPlayers[id],
      players: Object.values(mockPlayers)
    }
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'], { engine: mockEngine })
    assert.strictEqual(cs.battleState['A'].tempAttack, 5)
    assert.strictEqual(cs.battleState['A'].tempDefense, 3)
    assert.strictEqual(cs.battleState['B'].tempAttack, 3)
    assert.strictEqual(cs.battleState['B'].tempDefense, 5)
  })

  it('getCurrentPlayer应返回正确顺序', () => {
    const cs = new CombatSystem()
    cs.order = ['A', 'B', 'C', 'D']
    cs.currentIdx = 0
    cs.battleState = {
      A: { id: 'A', alive: true },
      B: { id: 'B', alive: true },
      C: { id: 'C', alive: true },
      D: { id: 'D', alive: true }
    }
    assert.strictEqual(cs.getCurrentPlayer(), 'A')
    cs.currentIdx = 2
    assert.strictEqual(cs.getCurrentPlayer(), 'C')
  })

  it('已死玩家应跳过', () => {
    const cs = new CombatSystem()
    cs.order = ['A', 'B', 'C', 'D']
    cs.currentIdx = 1
    cs.battleState = {
      A: { id: 'A', alive: true },
      B: { id: 'B', alive: false },
      C: { id: 'C', alive: true },
      D: { id: 'D', alive: true }
    }
    // currentIdx=1但B死了，应跳到C
    assert.strictEqual(cs.getCurrentPlayer(), 'C')
  })

  it('攻击无招式卡的玩家应返回空命中', () => {
    const cs = new CombatSystem()
    cs.order = ['A']
    cs.currentIdx = 0
    cs.battleState = {
      A: { id: 'A', alive: true, pos: 0, direction: 'N', tempAttack: 5, tempDefense: 3,
           cards: { position_single: 0, position_all: 0, combo: 0, teleport: 0, dodge: 0, reflect: 0 },
           talentCards: [] },
      B: { id: 'B', alive: true, pos: 5, direction: 'S', tempAttack: 3, tempDefense: 5,
           cards: { position_single: 0, position_all: 0, combo: 0, teleport: 0, dodge: 0, reflect: 0 },
           talentCards: [] }
    }
    // 无engine引用也无招式卡
    const result = cs.handleAction({ type: 'ATTACK', playerId: 'A' })
    assert.ok(result)
    assert.strictEqual(result.type, 'ATTACK')
  })

  it('移动应在相邻格之间', () => {
    const cs = new CombatSystem()
    // 手动设置位置确保可预测
    cs.startBattle(['A', 'B'])
    cs.battleState['A'].pos = 0  // 00号中心格
    cs.battleState['B'].pos = 5
    const adj = cs.board.getAdjacent(0)
    assert.ok(adj.length > 0, '中心格应有相邻格')
    const result = cs.handleAction({
      type: 'MOVE',
      playerId: 'A',
      data: { to: adj[0] }
    })
    assert.strictEqual(result.moved, true, '应能移动到相邻格')
    assert.strictEqual(cs.battleState['A'].pos, adj[0], '位置应更新')
  })

  it('移动到不相邻格子应返回失败', () => {
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'])
    // 用不存在的格子ID
    const result = cs.handleAction({
      type: 'MOVE',
      playerId: 'A',
      data: { to: 36 }
    })
    assert.strictEqual(result.moved, false)
  })

  it('购买商店卡应成功', () => {
    const mockEngine = {
      getPlayer: (id) => ({ id, attack: 5, defense: 3, gold: 10, removeGold: (n) => Math.min(n, 10) })
    }
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'], { engine: mockEngine })
    const result = cs.handleAction({ type: 'BUY_CARD', playerId: 'A', data: { cardType: 'dodge', cost: 3 } })
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.cardType, 'dodge')
    assert.strictEqual(cs.battleState['A'].cards.dodge, 1)
  })

  it('已持有同名卡不可再买', () => {
    const mockEngine = {
      getPlayer: (id) => ({ id, attack: 5, defense: 3, gold: 10, removeGold: (n) => Math.min(n, 10) })
    }
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'], { engine: mockEngine })
    cs.battleState['A'].cards.dodge = 1
    const result = cs.handleAction({ type: 'BUY_CARD', playerId: 'A', data: { cardType: 'dodge', cost: 3 } })
    assert.strictEqual(result.success, false)
    assert.ok(result.message.includes('已持有同名卡'))
  })

  it('endTurn应推进出手索引', () => {
    const cs = new CombatSystem()
    cs.order = ['A', 'B', 'C', 'D']
    cs.battleState = {
      A: { id: 'A', alive: true, pos: 0 },
      B: { id: 'B', alive: true, pos: 5 },
      C: { id: 'C', alive: true, pos: 14 },
      D: { id: 'D', alive: true, pos: 27 }
    }
    assert.strictEqual(cs.currentIdx, 0)
    cs.endTurn()
    assert.strictEqual(cs.currentIdx, 1)
  })

  it('endTurn在一轮后应增加圆数', () => {
    const cs = new CombatSystem()
    cs.order = ['A', 'B']
    cs.battleState = {
      A: { id: 'A', alive: true, pos: 0 },
      B: { id: 'B', alive: true, pos: 5 }
    }
    cs.endTurn()
    assert.strictEqual(cs.round, 0)
    cs.endTurn()
    // 两个玩家都完成一次出手
    assert.strictEqual(cs.currentIdx, 0)
    assert.strictEqual(cs.round, 1)
    assert.strictEqual(cs.board.round, 1)
  })

  it('投降应标记玩家阵亡', () => {
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'])
    const result = cs.handleAction({ type: 'SURRENDER', playerId: 'A' })
    assert.strictEqual(cs.battleState['A'].alive, false)
    assert.ok(result.message.includes('投降'))
  })

  it('全军覆没后同归于尽', () => {
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'])
    cs.battleState['A'].alive = false
    cs.battleState['B'].alive = false
    const end = cs.checkEndOfBattle()
    assert.strictEqual(end.isOver, true)
    assert.strictEqual(end.allDead, true)
  })

  it('只剩一人时比武结束', () => {
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'])
    cs.battleState['B'].alive = false
    const end = cs.checkEndOfBattle()
    assert.strictEqual(end.isOver, true)
    assert.strictEqual(end.victorId, 'A')
  })

  it('六边形方向名应是6个', () => {
    const dirNames = Object.keys(DIRS)
    assert.strictEqual(dirNames.length, 6)
    assert.ok(dirNames.includes('N'))
    assert.ok(dirNames.includes('NE'))
    assert.ok(dirNames.includes('SE'))
    assert.ok(dirNames.includes('S'))
    assert.ok(dirNames.includes('SW'))
    assert.ok(dirNames.includes('NW'))
  })

  it('缩圈5轮后场地缩小', () => {
    const cs = new CombatSystem()
    cs.startBattle(['A', 'B'])
    // 2个玩家，一圈完成 = 2次endTurn
    for (let i = 0; i < 12; i++) {
      cs.endTurn()
    }
    // 12次endTurn = 6圈 = round=6
    // round > 5 应缩到 layer3
    assert.strictEqual(cs.round, 6)
    assert.strictEqual(cs.board.getActiveLayerName(), 'layer3')
  })
})
