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
  it('[0,0]路口有2个方向（含掉头）', () => {
    const board = new Board()
    // 从[1,0]来到[0,0]路口，可选[0,1]或掉头[1,0]
    const nexts = board.getNextCells([0, 0], [1, 0])
    assert.strictEqual(nexts.length, 2)
  })

  it('[0,0]路口无来路时也有2个方向', () => {
    const board = new Board()
    const nexts = board.getNextCells([0, 0])
    assert.strictEqual(nexts.length, 2)
  })

  it('[0,1]普通格有来路时只有1个前进方向（不可掉头）', () => {
    const board = new Board()
    // 从[0,0]来到[0,1]，只能继续向[0,2]
    const nexts = board.getNextCells([0, 1], [0, 0])
    assert.strictEqual(nexts.length, 1)
    assert.deepStrictEqual(nexts[0], [0, 2])
  })

  it('[0,1]普通格无来路时返回两个连接', () => {
    const board = new Board()
    // 无来路时返回全部连接（[0,0]和[0,2]）
    const nexts = board.getNextCells([0, 1])
    assert.strictEqual(nexts.length, 2)
  })

  it('[0,4]路口（纵轴入口）：从左来时有3个方向含掉头', () => {
    const board = new Board()
    // 从[0,3]来到[0,4]，可选右[0,5]、下[1,4]、掉头[0,3]
    const nexts = board.getNextCells([0, 4], [0, 3])
    assert.strictEqual(nexts.length, 3)
    const keys = nexts.map(n => `${n[0]},${n[1]}`)
    assert.ok(keys.includes('0,3'), '应含掉头方向[0,3]')
    assert.ok(keys.includes('0,5'), '应含右方向[0,5]')
    assert.ok(keys.includes('1,4'), '应含纵轴方向[1,4]')
  })

  it('[4,4]中心路口有4个方向（任何来路都可掉头）', () => {
    const board = new Board()
    // 从[4,3]来，可选左[4,3]掉头、右[4,5]、上[3,4]、下[5,4]
    const nexts = board.getNextCells([4, 4], [4, 3])
    assert.strictEqual(nexts.length, 4)
  })

  it('路口掉头：[0,0]来自[0,1]可选回到[0,1]', () => {
    const board = new Board()
    // 从[0,1]来到[0,0]路口，可掉头回[0,1]
    const nexts = board.getNextCells([0, 0], [0, 1])
    const keys = nexts.map(n => `${n[0]},${n[1]}`)
    assert.ok(keys.includes('0,1'), '路口应允许掉头回来路')
  })
})

describe('Board advance（多步前进）', () => {
  it('从[0,1]前进2步应到[0,3]（有来路排除掉头）', () => {
    const board = new Board()
    // 从[0,0]来到[0,1]，继续前进2步：[0,1]→[0,2]→[0,3]
    const result = board.advance([0, 1], 2, [0, 0])
    assert.deepStrictEqual(result.pos, [0, 3])
    assert.strictEqual(result.passedJunctions.length, 0)
  })

  it('从[0,3]前进1步应到比武格[0,4]', () => {
    const board = new Board()
    const result = board.advance([0, 3], 1, [0, 2])
    assert.deepStrictEqual(result.pos, [0, 4])
  })

  it('路口[0,0]前进1步，选择索引0应到第一个选项', () => {
    const board = new Board()
    // 无来路，choices=[0]
    const result = board.advance([0, 0], 1, null, [0])
    assert.strictEqual(result.passedJunctions.length, 1)
    // 应到达[0,0]的第一个邻居
    assert.ok(result.pos !== null)
  })

  it('路口[0,0]掉头：从[0,1]来可选掉头回[0,1]', () => {
    const board = new Board()
    // 从[0,1]来到[0,0]，掉头=选[0,1]方向
    // [0,0]的neighbors是[[0,1],[1,0]]，从[0,1]来时，[0,1]排在某个索引
    const nexts = board.getNextCells([0, 0], [0, 1])
    const turnBackIdx = nexts.findIndex(n => n[0] === 0 && n[1] === 1)
    assert.ok(turnBackIdx >= 0, '掉头方向应在选项中')
    const result = board.advance([0, 0], 1, [0, 1], [turnBackIdx])
    assert.deepStrictEqual(result.pos, [0, 1])
  })

  it('前进时经过的路口应被记录，并含options', () => {
    const board = new Board()
    // 从[0,2]来，走3步经过路口[0,4]，选择继续向右[0,5]
    // [0,2]→[0,3]→[0,4](路口，索引选[0,5])→[0,5]
    const result = board.advance([0, 3], 2, [0, 2], [0])
    assert.strictEqual(result.passedJunctions.length, 1)
    assert.deepStrictEqual(result.passedJunctions[0].pos, [0, 4])
    assert.ok(Array.isArray(result.passedJunctions[0].options))
    assert.ok(result.passedJunctions[0].options.length >= 2)
  })

  it('advance返回prevPos供下次调用使用', () => {
    const board = new Board()
    const result = board.advance([0, 1], 2, [0, 0])
    // 走了2步，prevPos应是倒数第二格[0,2]
    assert.deepStrictEqual(result.prevPos, [0, 2])
    assert.deepStrictEqual(result.pos, [0, 3])
  })

  it('从[4,3]前进1步到中心路口[4,4]', () => {
    const board = new Board()
    const result = board.advance([4, 3], 1, [4, 2])
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

describe('Board scoreDirection & bestDirection', () => {
  it('scoreDirection：招式格方向得分高于修炼格方向', () => {
    const board = new Board()
    // 从[0,0]出发，预算4步
    // 方向[0,1]（沿上边走）：路径上有 [0,1]修炼, [0,2]机遇, [0,3]事件, [0,4]比武
    // 方向[1,0]（往下走）：路径上有 [1,0]招式, [2,0]修炼, [3,0]内功...
    const scoreRight = board.scoreDirection([0, 0], [0, 1], 4)
    const scoreDown  = board.scoreDirection([0, 0], [1, 0], 4)
    // [1,0]方向含招式格（权重10），得分应更高
    assert.ok(scoreDown > 0, '向下方向得分应>0')
    assert.ok(scoreRight > 0, '向右方向得分应>0')
  })

  it('scoreDirection：budget=0 时只计第一格', () => {
    const board = new Board()
    // budget=1：只有 nextPos 本身被计入（stepsLeft=0 后不再扩展）
    const score = board.scoreDirection([0, 0], [0, 1], 1)
    // [0,1] 是修炼格，权重6
    assert.strictEqual(score, 6)
  })

  it('bestDirection：路口选出得分最高的方向索引', () => {
    const board = new Board()
    // [0,0] 路口，预算4步
    // 验证返回的是有效索引
    const idx = board.bestDirection([0, 0], null, 4)
    const options = board.getNextCells([0, 0], null)
    assert.ok(idx >= 0 && idx < options.length, '返回索引应在合法范围内')
  })

  it('bestDirection：只有1个方向时返回0', () => {
    const board = new Board()
    // 普通格 [0,1]，无来路时有2个连接，但有来路时只有1个
    const idx = board.bestDirection([0, 1], [0, 0], 3)
    assert.strictEqual(idx, 0)
  })

  it('scoreDirection 使用自定义权重：只有 rest 有权重时，路径含休整格才得分', () => {
    const board = new Board()
    // 只给 rest 权重，其他全0
    const weights = { move: 0, cultivate: 0, neigong: 0, opportunity: 0, rest: 100, event: 0, battle: 0 }
    // 从[0,0]向[0,1]走10步，沿上边走会经过[0,8]（休整格），得分应为100
    const scoreToRest = board.scoreDirection([0, 0], [0, 1], 10, weights)
    assert.ok(scoreToRest > 0, '路径含休整格时得分应>0')

    // 从[0,0]向[1,0]走3步：[1,0]招式, [2,0]修炼, [3,0]内功，无休整格，得分应为0
    const scoreNoRest = board.scoreDirection([0, 0], [1, 0], 3, weights)
    assert.strictEqual(scoreNoRest, 0, '路径无休整格时得分应为0')
  })
})
