/**
 * Board 类单元测试（田字格版本）
 * 测试：格子总数、格子类型、路口判定、前进逻辑、距离计算
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Board } from '../engine/board.js'

describe('Board 初始化', () => {
  it('应有45格', () => {
    const board = new Board()
    assert.strictEqual(board.cellCount, 45)
    assert.strictEqual(board.cells.length, 45)
  })

  it('所有格子类型应合法', () => {
    const board = new Board()
    const validTypes = ['cultivate', 'opportunity', 'event', 'move', 'neigong', 'battle', 'rest']
    for (const pos of board.cells) {
      const type = board.getType(pos)
      assert.ok(validTypes.includes(type), `格子[${pos}]类型异常: ${type}`)
    }
  })

  it('各类型格子数量应正确', () => {
    const board = new Board()
    const counts = {}
    for (const pos of board.cells) {
      const t = board.getType(pos)
      counts[t] = (counts[t] || 0) + 1
    }
    assert.strictEqual(counts.rest, 5, `休整格应有5格，实际${counts.rest}`)
    assert.strictEqual(counts.battle, 4, `比武格应有4格，实际${counts.battle}`)
    assert.strictEqual(counts.cultivate, 12, `修炼格应有12格，实际${counts.cultivate}`)
    assert.strictEqual(counts.move, 4, `招式格应有4格，实际${counts.move}`)
    assert.strictEqual(counts.neigong, 6, `内功格应有6格，实际${counts.neigong}`)
    assert.strictEqual(counts.opportunity, 7, `机遇格应有7格，实际${counts.opportunity}`)
    assert.strictEqual(counts.event, 7, `事件格应有7格，实际${counts.event}`)
  })
})

describe('Board 格子类型查询', () => {
  it('[0,0] 应为休整格', () => {
    const board = new Board()
    assert.strictEqual(board.getType([0, 0]), 'rest')
  })

  it('[4,4] 应为休整格（中心）', () => {
    const board = new Board()
    assert.strictEqual(board.getType([4, 4]), 'rest')
  })

  it('[0,4] 应为比武格', () => {
    const board = new Board()
    assert.strictEqual(board.getType([0, 4]), 'battle')
  })

  it('[4,0] 应为比武格', () => {
    const board = new Board()
    assert.strictEqual(board.getType([4, 0]), 'battle')
  })

  it('[4,8] 应为比武格', () => {
    const board = new Board()
    assert.strictEqual(board.getType([4, 8]), 'battle')
  })

  it('[8,4] 应为比武格', () => {
    const board = new Board()
    assert.strictEqual(board.getType([8, 4]), 'battle')
  })

  it('无效坐标应返回null', () => {
    const board = new Board()
    assert.strictEqual(board.getType([1, 1]), null)
    assert.strictEqual(board.getType([9, 9]), null)
  })
})

describe('Board 路口判定', () => {
  it('休整格[0,0]是路口', () => {
    const board = new Board()
    assert.strictEqual(board.isJunction([0, 0]), true)
  })

  it('比武格[0,4]是路口', () => {
    const board = new Board()
    assert.strictEqual(board.isJunction([0, 4]), true)
  })

  it('中心[4,4]是路口', () => {
    const board = new Board()
    assert.strictEqual(board.isJunction([4, 4]), true)
  })

  it('普通格[0,1]不是路口', () => {
    const board = new Board()
    assert.strictEqual(board.isJunction([0, 1]), false)
  })

  it('修炼格[0,6]不是路口', () => {
    const board = new Board()
    assert.strictEqual(board.isJunction([0, 6]), false)
  })
})

describe('Board isBattleCell', () => {
  it('[0,4]是比武格', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell([0, 4]), true)
  })

  it('[4,0]是比武格', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell([4, 0]), true)
  })

  it('[0,0]不是比武格（是休整格）', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell([0, 0]), false)
  })

  it('[0,1]不是比武格', () => {
    const board = new Board()
    assert.strictEqual(board.isBattleCell([0, 1]), false)
  })
})

describe('Board 前进逻辑 getNextCells', () => {
  it('[0,0]路口有2个前进方向', () => {
    const board = new Board()
    const nexts = board.getNextCells([0, 0])
    assert.strictEqual(nexts.length, 2)
  })

  it('[0,1]普通格只有1个前进方向', () => {
    const board = new Board()
    const nexts = board.getNextCells([0, 1])
    assert.strictEqual(nexts.length, 1)
    assert.deepStrictEqual(nexts[0], [0, 2])
  })

  it('[0,4]比武格（纵轴入口）有2个前进方向', () => {
    const board = new Board()
    const nexts = board.getNextCells([0, 4])
    assert.strictEqual(nexts.length, 2)
  })

  it('[4,4]中心路口有4个前进方向', () => {
    const board = new Board()
    const nexts = board.getNextCells([4, 4])
    assert.strictEqual(nexts.length, 4)
  })

  it('上边顺时针：[0,1]→[0,2]→[0,3]', () => {
    const board = new Board()
    assert.deepStrictEqual(board.getNextCells([0, 1])[0], [0, 2])
    assert.deepStrictEqual(board.getNextCells([0, 2])[0], [0, 3])
    assert.deepStrictEqual(board.getNextCells([0, 3])[0], [0, 4])
  })
})

describe('Board advance（多步前进）', () => {
  it('从[0,1]前进2步应到[0,3]', () => {
    const board = new Board()
    const result = board.advance([0, 1], 2)
    assert.deepStrictEqual(result.pos, [0, 3])
    assert.strictEqual(result.passedJunctions.length, 0)
  })

  it('从[0,3]前进1步应到比武格[0,4]', () => {
    const board = new Board()
    const result = board.advance([0, 3], 1)
    assert.deepStrictEqual(result.pos, [0, 4])
  })

  it('路口[0,0]前进1步，选择索引0应到[0,1]', () => {
    const board = new Board()
    const result = board.advance([0, 0], 1, [0])
    assert.deepStrictEqual(result.pos, [0, 1])
    assert.strictEqual(result.passedJunctions.length, 1)
  })

  it('路口[0,0]前进1步，选择索引1应到[1,0]', () => {
    const board = new Board()
    const result = board.advance([0, 0], 1, [1])
    assert.deepStrictEqual(result.pos, [1, 0])
  })

  it('前进时经过的路口应被记录', () => {
    const board = new Board()
    // 从[0,3]走3步：[0,3]→[0,4](路口)→[0,5]→[0,6]，选择在(0,4)处走外圈方向
    const result = board.advance([0, 3], 3, [0])
    assert.strictEqual(result.passedJunctions.length, 1)
    assert.deepStrictEqual(result.passedJunctions[0], [0, 4])
  })

  it('从[4,3]前进1步到中心路口[4,4]', () => {
    const board = new Board()
    const result = board.advance([4, 3], 1)
    assert.deepStrictEqual(result.pos, [4, 4])
  })
})

describe('Board 距离计算', () => {
  it('相邻格子距离为1', () => {
    const board = new Board()
    assert.strictEqual(board.getDistance([0, 0], [0, 1]), 1)
  })

  it('对角格子距离为2', () => {
    const board = new Board()
    assert.strictEqual(board.getDistance([0, 0], [1, 1]), 2)
  })

  it('同一格子距离为0', () => {
    const board = new Board()
    assert.strictEqual(board.getDistance([4, 4], [4, 4]), 0)
  })

  it('[0,0]到[8,8]距离为16', () => {
    const board = new Board()
    assert.strictEqual(board.getDistance([0, 0], [8, 8]), 16)
  })
})

describe('Board 辅助方法', () => {
  it('getStartPositions 应返回5个休整格', () => {
    const board = new Board()
    const starts = board.getStartPositions()
    assert.strictEqual(starts.length, 5)
  })

  it('getBattleCells 应返回4个比武格', () => {
    const board = new Board()
    const battleCells = board.getBattleCells()
    assert.strictEqual(battleCells.length, 4)
  })

  it('getCellsByType cultivate 应返回12格', () => {
    const board = new Board()
    assert.strictEqual(board.getCellsByType('cultivate').length, 12)
  })

  it('isValidPos 有效格子返回true', () => {
    const board = new Board()
    assert.strictEqual(board.isValidPos([0, 0]), true)
    assert.strictEqual(board.isValidPos([4, 4]), true)
  })

  it('isValidPos 无效格子返回false', () => {
    const board = new Board()
    assert.strictEqual(board.isValidPos([1, 1]), false)
    assert.strictEqual(board.isValidPos([9, 9]), false)
  })

  it('getCell 返回副本，修改不影响原数据', () => {
    const board = new Board()
    const cell = board.getCell([0, 0])
    assert.strictEqual(cell.type, 'rest')
    cell.type = 'battle'
    assert.strictEqual(board.getType([0, 0]), 'rest')
  })
})
