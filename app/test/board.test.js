/**
 * Board 类单元测试
 * 测试：格子类型、前进、距离计算、比武格判定
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Board } from '../engine/board.js'

describe('Board 初始化', () => {
  it('应有32格', () => {
    const board = new Board()
    assert.strictEqual(board.cellCount, 32)
    assert.strictEqual(board.cells.length, 32)
  })

  it('第0格应为休整格', () => {
    const board = new Board()
    assert.strictEqual(board.getType(0), 'rest')
  })

  it('第8格和第31格应为比武格', () => {
    const board = new Board()
    assert.strictEqual(board.getType(8), 'battle')
    assert.strictEqual(board.getType(31), 'battle')
  })

  it('所有格子类型应合法', () => {
    const board = new Board()
    const validTypes = ['cultivate', 'opportunity', 'event', 'move', 'neigong', 'battle', 'rest']
    for (let i = 0; i < board.cellCount; i++) {
      const type = board.getType(i)
      assert.ok(validTypes.includes(type), `格子${i}类型异常: ${type}`)
    }
  })
})

describe('Board 前进', () => {
  it('前进1步应到下一格', () => {
    const board = new Board()
    assert.strictEqual(board.advance(0, 1), 1)
  })

  it('前进超过32格应绕圈', () => {
    const board = new Board()
    assert.strictEqual(board.advance(30, 5), 3) // 30+5=35 → 35%32=3
  })

  it('后退应正确绕圈', () => {
    const board = new Board()
    assert.strictEqual(board.advance(0, -1), 31) // 0-1=-1 → 32+(-1)=31
  })

  it('3步前进', () => {
    const board = new Board()
    assert.strictEqual(board.advance(5, 3), 8)
  })

  it('完整一圈回到原位', () => {
    const board = new Board()
    assert.strictEqual(board.advance(10, 32), 10)
  })
})

describe('Board 距离计算', () => {
  it('相邻格子距离为1', () => {
    const board = new Board()
    assert.strictEqual(board.getDistance(0, 1), 1)
  })

  it('6步内的距离直接返回', () => {
    const board = new Board()
    assert.strictEqual(board.getDistance(0, 7), 7)
  })

  it('19步距离应该返回反方向-13', () => {
    const board = new Board()
    // 5→24: 正向19, 反方向-13 (因为32-19=13)
    assert.strictEqual(board.getDistance(5, 24), -13)
  })

  it('距离16应返回16或-16', () => {
    const board = new Board()
    const d = board.getDistance(0, 16)
    assert.strictEqual(Math.abs(d), 16)
  })

  it('同一格子距离为0', () => {
    const board = new Board()
    assert.strictEqual(board.getDistance(7, 7), 0)
  })
})

describe('Board 比武格判定', () => {
  it('第8格是比武格', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell(8), true)
  })

  it('第31格是比武格', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell(31), true)
  })

  it('第0格不是比武格', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell(0), false)
  })

  it('第5格(内功格)不是比武格', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell(5), false)
  })
})

describe('Board 格子查询', () => {
  it('getCell应返回格子副本（不可变）', () => {
    const board = new Board()
    const cell = board.getCell(0)
    assert.strictEqual(cell.index, 0)
    assert.strictEqual(cell.type, 'rest')
    // 验证不修改原数组
    cell.type = 'battle'
    assert.strictEqual(board.getCell(0).type, 'rest')
  })

  it('getDistance绕圈反方向测试', () => {
    const board = new Board()
    // 0→25: 正向25, 反方向-7 (25>16所以返回-7)
    assert.strictEqual(board.getDistance(0, 25), -7)
  })
})
