/**
 * @class Board
 * @description 45格田字格跑道棋盘。
 *
 * 地图结构：9×9网格中的田字格路径。
 * 坐标系：[row, col]，row和col均为0~8。
 * 田字格路径由外圈（row=0/8或col=0/8）+ 中轴线（row=4或col=4）构成，共45格。
 *
 * 规则书 §2.2 格子坐标定义：
 *
 * 格子类型分布：
 * - 修炼(cultivate) 12格: [0,1],[0,6],[1,8],[2,0],[3,4],[4,3],[4,6],[5,0],[6,8],[7,4],[8,2],[8,7]
 * - 招式(move)      4格: [0,7],[7,8],[8,1],[1,0]
 * - 内功(neigong)   6格: [0,5],[2,4],[3,0],[3,8],[4,5],[8,6]
 * - 机遇(opportunity)7格: [0,2],[1,4],[4,1],[5,4],[5,8],[7,0],[8,3]
 * - 事件(event)     7格: [0,3],[2,8],[4,2],[4,7],[6,0],[6,4],[8,5]
 * - 比武(battle)    4格: [0,4],[4,0],[4,8],[8,4]
 * - 休整(rest)      5格: [0,0],[0,8],[8,8],[8,0],[4,4]
 *
 * 路口规则（§3.2）：
 * 路过休整格或比武格时，玩家可自由选择前进方向。
 * 其他路段格子只有一个前进方向（沿路径）。
 *
 * 路径走向说明：
 * 外圈：顺时针方向连接。
 * 中轴：row=4的横轴（col 0→4→8），col=4的纵轴（row 0→4→8）。
 * 路口（休整/比武格）是中轴与外圈的交汇点，玩家可在此选向。
 */

/**
 * 45格路径节点完整定义
 * key: "row,col"
 * value: { type, neighbors: [[r,c],...], isJunction }
 *
 * neighbors 是沿路径可前进的方向列表。
 * isJunction=true 表示路口（规则书：路过时可选择方向）。
 */
const CELL_MAP = (() => {
  // 所有格子的类型定义（来自规则书 §2.2）
  const typeDefs = {
    // 休整 5格
    '0,0': 'rest', '0,8': 'rest', '8,8': 'rest', '8,0': 'rest', '4,4': 'rest',
    // 比武 4格
    '0,4': 'battle', '4,0': 'battle', '4,8': 'battle', '8,4': 'battle',
    // 修炼 12格
    '0,1': 'cultivate', '0,6': 'cultivate', '1,8': 'cultivate', '2,0': 'cultivate',
    '3,4': 'cultivate', '4,3': 'cultivate', '4,6': 'cultivate', '5,0': 'cultivate',
    '6,8': 'cultivate', '7,4': 'cultivate', '8,2': 'cultivate', '8,7': 'cultivate',
    // 招式 4格
    '0,7': 'move', '7,8': 'move', '8,1': 'move', '1,0': 'move',
    // 内功 6格
    '0,5': 'neigong', '2,4': 'neigong', '3,0': 'neigong',
    '3,8': 'neigong', '4,5': 'neigong', '8,6': 'neigong',
    // 机遇 7格
    '0,2': 'opportunity', '1,4': 'opportunity', '4,1': 'opportunity',
    '5,4': 'opportunity', '5,8': 'opportunity', '7,0': 'opportunity', '8,3': 'opportunity',
    // 事件 7格
    '0,3': 'event', '2,8': 'event', '4,2': 'event', '4,7': 'event',
    '6,0': 'event', '6,4': 'event', '8,5': 'event'
  }

  /**
   * 路口格子（休整+比武）：玩家可在此选择前进方向
   * 规则书 §3.2：路过休整和比武格时可随意选择前进方向
   */
  const JUNCTIONS = new Set([
    '0,0', '0,4', '0,8',
    '4,0', '4,4', '4,8',
    '8,0', '8,4', '8,8'
  ])

  /**
   * 田字格完整路径邻接表
   * 按顺时针方向定义每格的"前进方向"列表。
   * 路口格有多个方向（玩家选择），普通格只有一个方向（强制前进）。
   *
   * 路径规则：
   * - 外圈顺时针：(0,0)→(0,1)→...→(0,8)→(1,8)→...→(8,8)→(8,7)→...→(8,0)→(7,0)→...→(0,0)
   * - 横轴：(4,0)→(4,1)→...→(4,4)→...→(4,8)，双向
   * - 纵轴：(0,4)→(1,4)→...→(4,4)→...→(8,4)，双向
   * - 路口处连通多条路径
   */
  const neighbors = {
    // ===== 上边 row=0 =====
    '0,0': [[0,1], [1,0]],          // 路口：向右或向下
    '0,1': [[0,2]],
    '0,2': [[0,3]],
    '0,3': [[0,4]],
    '0,4': [[0,5], [1,4]],          // 路口：向右或向下（纵轴入口）
    '0,5': [[0,6]],
    '0,6': [[0,7]],
    '0,7': [[0,8]],
    '0,8': [[1,8], [0,7]],          // 路口：向下或向左（此处为角落，实际只能向下）

    // ===== 右边 col=8 =====
    '1,8': [[2,8]],
    '2,8': [[3,8]],
    '3,8': [[4,8]],
    '4,8': [[5,8], [4,7]],          // 路口：向下或向左（横轴入口）
    '5,8': [[6,8]],
    '6,8': [[7,8]],
    '7,8': [[8,8]],
    '8,8': [[8,7], [7,8]],          // 路口：向左或向上（角落）

    // ===== 下边 row=8 =====
    '8,7': [[8,6]],
    '8,6': [[8,5]],
    '8,5': [[8,4]],
    '8,4': [[8,3], [7,4]],          // 路口：向左或向上（纵轴入口）
    '8,3': [[8,2]],
    '8,2': [[8,1]],
    '8,1': [[8,0]],
    '8,0': [[7,0], [8,1]],          // 路口：向上或向右（角落）

    // ===== 左边 col=0 =====
    '7,0': [[6,0]],
    '6,0': [[5,0]],
    '5,0': [[4,0]],
    '4,0': [[3,0], [4,1]],          // 路口：向上或向右（横轴入口）
    '3,0': [[2,0]],
    '2,0': [[1,0]],
    '1,0': [[0,0]],

    // ===== 纵轴 col=4，row=1~3（上半段，从上往下） =====
    '1,4': [[2,4]],
    '2,4': [[3,4]],
    '3,4': [[4,4]],

    // ===== 纵轴 col=4，row=5~7（下半段，从上往下） =====
    '5,4': [[6,4]],
    '6,4': [[7,4]],
    '7,4': [[8,4]],

    // ===== 横轴 row=4，col=1~3（左半段，从左往右） =====
    '4,1': [[4,2]],
    '4,2': [[4,3]],
    '4,3': [[4,4]],

    // ===== 横轴 row=4，col=5~7（右半段，从左往右） =====
    '4,5': [[4,6]],
    '4,6': [[4,7]],
    '4,7': [[4,8]],

    // ===== 中心路口 (4,4)：四个方向都可去 =====
    '4,4': [[4,5], [5,4], [4,3], [3,4]]  // 右/下/左/上
  }

  // 修正角落路口的邻接（角落只有两条路可走，玩家可在此选择）
  // (0,8)：上边终点=右边起点，可选向下或沿上边回头（规则书未明确，这里限定为向下继续）
  // 实际上角落是单向的，不是真路口，只有(0,4)(4,0)(4,8)(8,4)(4,4)是真路口
  // 把角落简化为单向（不允许回头）
  neighbors['0,8'] = [[1,8]]
  neighbors['8,8'] = [[8,7]]
  neighbors['8,0'] = [[7,0]]

  // 构建 CELL_MAP
  const map = {}
  for (const [key, type] of Object.entries(typeDefs)) {
    map[key] = {
      type,
      neighbors: neighbors[key] || [],
      isJunction: JUNCTIONS.has(key)
    }
  }

  return map
})()

/** 所有格子坐标列表（用于验证） */
const ALL_CELLS = Object.keys(CELL_MAP).map(k => k.split(',').map(Number))

class Board {
  constructor () {
    /** @type {Object} 格子定义表，key="row,col" */
    this.cellMap = CELL_MAP

    /** @type {number[][]} 所有格子坐标列表 */
    this.cells = ALL_CELLS

    /** @type {number} 格子总数 */
    this.cellCount = ALL_CELLS.length
  }

  // ============ 坐标工具 ============

  /**
   * @method key
   * @param {number[]} pos — [row, col]
   * @returns {string} — "row,col"
   */
  key (pos) {
    return `${pos[0]},${pos[1]}`
  }

  /**
   * @method parseKey
   * @param {string} k — "row,col"
   * @returns {number[]} — [row, col]
   */
  parseKey (k) {
    return k.split(',').map(Number)
  }

  // ============ 查询方法 ============

  /**
   * @method getType
   * @param {number[]} pos — [row, col]
   * @returns {string} — 格子类型
   */
  getType (pos) {
    const cell = this.cellMap[this.key(pos)]
    return cell ? cell.type : null
  }

  /**
   * @method getCell
   * @param {number[]} pos — [row, col]
   * @returns {Object|null} — 格子定义副本
   */
  getCell (pos) {
    const cell = this.cellMap[this.key(pos)]
    if (!cell) return null
    return {
      pos: [...pos],
      type: cell.type,
      neighbors: cell.neighbors.map(n => [...n]),
      isJunction: cell.isJunction
    }
  }

  /**
   * @method isValidPos
   * @param {number[]} pos — [row, col]
   * @returns {boolean}
   */
  isValidPos (pos) {
    return this.key(pos) in this.cellMap
  }

  /**
   * @method isBattleCell
   * @param {number[]} pos — [row, col]
   * @returns {boolean}
   */
  isBattleCell (pos) {
    return this.getType(pos) === 'battle'
  }

  /**
   * @method isRestCell
   * @param {number[]} pos — [row, col]
   * @returns {boolean}
   */
  isRestCell (pos) {
    return this.getType(pos) === 'rest'
  }

  /**
   * @method isJunction
   * @param {number[]} pos — [row, col]
   * @returns {boolean}
   * @description 是否路口（休整格或比武格），玩家可在此选择前进方向
   */
  isJunction (pos) {
    const cell = this.cellMap[this.key(pos)]
    return cell ? cell.isJunction : false
  }

  /**
   * @method getNextCells
   * @param {number[]} pos — 当前位置 [row, col]
   * @returns {number[][]} — 可前进的格子坐标列表
   * @description 返回从当前格子可以前进的方向列表。
   * - 普通格返回1个（强制方向）
   * - 路口返回2~4个（玩家选择）
   */
  getNextCells (pos) {
    const cell = this.cellMap[this.key(pos)]
    if (!cell) return []
    return cell.neighbors.map(n => [...n])
  }

  /**
   * @method advanceOneStep
   * @param {number[]} pos — 当前位置
   * @param {number} [choiceIndex=0] — 路口时的选择索引（默认取第0个）
   * @returns {number[]} — 下一格坐标
   * @description 前进一步。普通格自动前进，路口格按 choiceIndex 选择。
   * 用于模拟器（自动决策）。UI层应使用 getNextCells 展示选项给玩家。
   */
  advanceOneStep (pos, choiceIndex = 0) {
    const nexts = this.getNextCells(pos)
    if (nexts.length === 0) return pos
    const idx = Math.min(choiceIndex, nexts.length - 1)
    return nexts[idx]
  }

  /**
   * @method advance
   * @param {number[]} fromPos — 起始位置
   * @param {number} steps — 前进步数
   * @param {number[]} [choices=[]] — 路口选择序列（索引列表，模拟器用）
   * @returns {{ pos: number[], passedJunctions: number[][] }}
   * @description 从 fromPos 前进 steps 步，返回最终位置和途经的路口坐标。
   * 路口选择由 choices 参数提供（模拟器：choices[i] 是第i个路口的选择索引）。
   * 没有提供选择时默认取索引0（继续当前方向）。
   */
  advance (fromPos, steps, choices = []) {
    let pos = [...fromPos]
    const passedJunctions = []
    let choiceUsed = 0

    for (let i = 0; i < steps; i++) {
      const nexts = this.getNextCells(pos)
      if (nexts.length === 0) break

      let nextPos
      if (nexts.length > 1) {
        // 路口：需要选择
        passedJunctions.push([...pos])
        const choice = choices[choiceUsed] ?? 0
        choiceUsed++
        nextPos = nexts[Math.min(choice, nexts.length - 1)]
      } else {
        nextPos = nexts[0]
      }
      pos = nextPos
    }

    return { pos, passedJunctions }
  }

  /**
   * @method getDistance
   * @param {number[]} a — 位置A [row, col]
   * @param {number[]} b — 位置B [row, col]
   * @returns {number} — 曼哈顿距离（模拟器用于判断相对远近）
   * @description 返回两个格子之间的曼哈顿距离。
   * 注意：这不是路径步数，只是粗略的空间距离，供模拟器用于目标选择。
   */
  getDistance (a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
  }

  /**
   * @method getStartPositions
   * @returns {number[][]} — 所有休整格坐标（玩家可选的出发点）
   * @description 规则书 §3.1：开始时玩家可选择任意一个空的休整格作为出发点
   */
  getStartPositions () {
    return Object.entries(this.cellMap)
      .filter(([, cell]) => cell.type === 'rest')
      .map(([k]) => this.parseKey(k))
  }

  /**
   * @method getBattleCells
   * @returns {number[][]} — 所有比武格坐标
   */
  getBattleCells () {
    return Object.entries(this.cellMap)
      .filter(([, cell]) => cell.type === 'battle')
      .map(([k]) => this.parseKey(k))
  }

  /**
   * @method getCellsByType
   * @param {string} type — 格子类型
   * @returns {number[][]} — 该类型所有格子坐标
   */
  getCellsByType (type) {
    return Object.entries(this.cellMap)
      .filter(([, cell]) => cell.type === type)
      .map(([k]) => this.parseKey(k))
  }

  // ============ 序列化 ============

  /**
   * @method toJSON
   * @returns {Object} — 棋盘状态快照
   */
  toJSON () {
    return {
      cellCount: this.cellCount,
      cells: this.cells.map(pos => ({
        pos,
        type: this.getType(pos),
        isJunction: this.isJunction(pos)
      }))
    }
  }
}

/**
 * @typedef {Object} CellDef
 * @property {number[]} pos — 格子坐标 [row, col]
 * @property {string} type — 格子类型
 * @property {number[][]} neighbors — 可前进的下一格坐标列表
 * @property {boolean} isJunction — 是否路口（可选择方向）
 */

export { Board }
