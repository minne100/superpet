/**
 * 开局流程测试（规则书 §3.1）
 * 覆盖：投骰排序、平局重投、宠物分配、天赋卡发放、起点分配
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { GameEngine } from '../engine/game-engine.js'

/** 共用辅助：init + 完整开局 */
function makeEngine (seed = 42) {
  const engine = new GameEngine({ seed })
  engine.init()
  return engine
}

// ===== rollForOrder =====

describe('rollForOrder 投骰排序', () => {
  it('返回包含全部4名玩家的顺序', () => {
    const engine = makeEngine(42)
    const { rolls, order } = engine.rollForOrder()
    assert.strictEqual(order.length, 4)
    assert.ok(['A', 'B', 'C', 'D'].every(id => order.includes(id)))
  })

  it('无平局时：一轮4次投骰即完成', () => {
    // seed=42: A=3, B=2, C=6, D=4 → 全部不同，无需重投
    const engine = makeEngine(42)
    const { rolls, order } = engine.rollForOrder()
    assert.strictEqual(rolls.length, 4, '无平局只需4次投骰')
    // 全部是第1轮
    assert.ok(rolls.every(r => r.round === 1))
  })

  it('无平局时：顺序按点数从高到低', () => {
    // seed=42: A=3, B=2, C=6, D=4 → 排序 C>D>A>B
    const engine = makeEngine(42)
    const { rolls, order } = engine.rollForOrder()
    const rollMap = Object.fromEntries(rolls.map(r => [r.playerId, r.value]))
    for (let i = 0; i < order.length - 1; i++) {
      assert.ok(
        rollMap[order[i]] >= rollMap[order[i + 1]],
        `第${i + 1}名(${order[i]})点数应≥第${i + 2}名(${order[i + 1]})`
      )
    }
  })

  it('平局时：只有平局玩家进行第2轮投骰', () => {
    // seed=99: A=5, B=5, C=4, D=2 → A/B平局，只有A/B重投
    const engine = makeEngine(99)
    const { rolls, order } = engine.rollForOrder()
    const round2 = rolls.filter(r => r.round === 2)
    assert.ok(round2.length === 2, '平局重投只有2人')
    assert.ok(round2.every(r => r.playerId === 'A' || r.playerId === 'B'))
  })

  it('平局时：平局组占高位名次，低分组在其后', () => {
    // seed=99: A=B=5 > C=4 > D=2
    // 第2轮 B=4 > A=2，最终顺序应为 B → A → C → D
    const engine = makeEngine(99)
    const { order } = engine.rollForOrder()
    assert.strictEqual(order[0], 'B', '平局重投高分者排第1')
    assert.strictEqual(order[1], 'A', '平局重投低分者排第2')
    assert.strictEqual(order[2], 'C', 'C排第3（4点）')
    assert.strictEqual(order[3], 'D', 'D排第4（2点）')
  })

  it('rollForOrder 后 turnManager 已按顺序初始化', () => {
    const engine = makeEngine(42)
    const { order } = engine.rollForOrder()
    assert.deepStrictEqual(engine.turnManager.order, order)
  })
})

// ===== assignPets =====

describe('assignPets 宠物分配', () => {
  it('按跑圈顺序分配宠物名称', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    const pets = ['猫', '狗', '兔子', '鹦鹉']
    engine.assignPets(pets)
    const order = engine.turnManager.order
    order.forEach((id, i) => {
      assert.strictEqual(engine.getPlayer(id).name, pets[i],
        `${id}的宠物应为${pets[i]}`)
    })
  })

  it('每个玩家获得2张天赋卡（必须项）', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    for (const player of engine.players) {
      assert.strictEqual(player.talentCards.length, 2,
        `${player.name}(${player.id})应有2张天赋卡`)
    }
  })

  it('天赋卡初始状态均为未使用', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    for (const player of engine.players) {
      for (const card of player.talentCards) {
        assert.strictEqual(card.used, false, `${card.name}应为未使用状态`)
      }
    }
  })

  it('猫的天赋卡为：单人位置卡 + 闪避卡', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    const cat = engine.players.find(p => p.name === '猫')
    const cardNames = cat.talentCards.map(c => c.name).sort()
    assert.deepStrictEqual(cardNames, ['单人位置卡', '闪避卡'].sort())
  })

  it('狗的天赋卡为：单人位置卡 + 反弹卡', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    const dog = engine.players.find(p => p.name === '狗')
    const cardNames = dog.talentCards.map(c => c.name).sort()
    assert.deepStrictEqual(cardNames, ['单人位置卡', '反弹卡'].sort())
  })

  it('兔子的天赋卡为：腾挪卡 + 闪避卡', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    const rabbit = engine.players.find(p => p.name === '兔子')
    const cardNames = rabbit.talentCards.map(c => c.name).sort()
    assert.deepStrictEqual(cardNames, ['腾挪卡', '闪避卡'].sort())
  })

  it('鹦鹉的天赋卡为：腾挪卡 + 反弹卡', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    const parrot = engine.players.find(p => p.name === '鹦鹉')
    const cardNames = parrot.talentCards.map(c => c.name).sort()
    assert.deepStrictEqual(cardNames, ['腾挪卡', '反弹卡'].sort())
  })

  it('assignPets 返回含天赋卡的分配记录', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    const result = engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    assert.strictEqual(result.length, 4)
    for (const r of result) {
      assert.ok(r.playerId)
      assert.ok(r.pet)
      assert.strictEqual(r.talentCards.length, 2)
    }
  })
})

// ===== assignStartPositions =====

describe('assignStartPositions 起点分配', () => {
  it('分配后玩家位置为有效的休整格坐标', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    const starts = engine.board.getStartPositions()
    const posMap = {}
    engine.players.forEach((p, i) => { posMap[p.id] = starts[i % starts.length] })
    engine.assignStartPositions(posMap)

    for (const player of engine.players) {
      assert.ok(Array.isArray(player.position), '位置应为[row,col]数组')
      const cellType = engine.board.getType(player.position)
      assert.strictEqual(cellType, 'rest', `起点${player.position}应为休整格`)
    }
  })

  it('分配后 phase 变为 run', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    assert.strictEqual(engine.phase, 'setup', '分配前应为setup')
    const starts = engine.board.getStartPositions()
    const posMap = {}
    engine.players.forEach((p, i) => { posMap[p.id] = starts[i % starts.length] })
    engine.assignStartPositions(posMap)
    assert.strictEqual(engine.phase, 'run', '分配后应为run')
  })

  it('分配后每个玩家 prevPosition 为 null', () => {
    const engine = makeEngine(42)
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    const starts = engine.board.getStartPositions()
    const posMap = {}
    engine.players.forEach((p, i) => { posMap[p.id] = starts[i % starts.length] })
    engine.assignStartPositions(posMap)
    for (const player of engine.players) {
      assert.strictEqual(player.prevPosition, null)
    }
  })
})

// ===== 完整开局流程整合 =====

describe('完整开局流程整合', () => {
  it('init → rollForOrder → assignPets → assignStartPositions 后可正常跑圈', () => {
    const engine = makeEngine(42)
    engine.init()
    engine.rollForOrder()
    engine.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    const starts = engine.board.getStartPositions()
    const posMap = {}
    engine.players.forEach((p, i) => { posMap[p.id] = starts[i % starts.length] })
    engine.assignStartPositions(posMap)

    // 能正常投骰和前进
    const pid = engine.turnManager.getCurrentPlayer()
    const diceResult = engine.applyAction({ type: 'ROLL_DICE', playerId: pid })
    assert.strictEqual(diceResult.success, true)
    assert.ok(diceResult.value >= 1 && diceResult.value <= 6)

    const advResult = engine.applyAction({
      type: 'ADVANCE', playerId: pid,
      data: { steps: diceResult.value }
    })
    assert.strictEqual(advResult.success, true)
    assert.ok(Array.isArray(engine.getPlayer(pid).position))
  })

  it('同一seed两个引擎开局结果完全一致', () => {
    const e1 = makeEngine(42); const e2 = makeEngine(42)
    const r1 = e1.rollForOrder(); const r2 = e2.rollForOrder()
    assert.deepStrictEqual(r1.order, r2.order)
    e1.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    e2.assignPets(['猫', '狗', '兔子', '鹦鹉'])
    for (const p of e1.players) {
      const p2 = e2.getPlayer(p.id)
      assert.strictEqual(p.name, p2.name)
      assert.deepStrictEqual(
        p.talentCards.map(c => c.name),
        p2.talentCards.map(c => c.name)
      )
    }
  })
})
