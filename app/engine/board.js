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
 * 路过休整格或比武格时，玩家可自由选择前进方向，包括180度掉头返回来路。
 * 因此路口的可选方向 = 该路口连接的所有格子（含来路）。
 * 其他路段格子只有一个前进方向（沿路径强制前进，不可掉头）。
 *
 * 路径走向说明：
 * 外圈：顺时针方向连接。
 * 中轴：row=4的横轴（col 0↔4↔8），col=4的纵轴（row 0↔4↔8）。
 * 路口（休整/比武格）是中轴与外圈的交汇点，玩家可在此选向（含掉头）。
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
   * 路口格子（休整+比武）：玩家可在此选择前进方向，含掉头
   * 规则书 §3.2：路过休整和比武格时可随意选择前进方向，包括180度掉头
   */
  const JUNCTIONS = new Set([
    '0,0', '0,4', '0,8',
    '4,0', '4,4', '4,8',
    '8,0', '8,4', '8,8'
  ])

  /**
   * 田字格路径邻接表（双向完整连接）
   *
   * 设计原则：
   * - 每个格子存储它在路径上"相邻连接"的所有格子（不分方向）
   * - 普通格：只有2个连接（前后各一个），getNextCells时排除来路 → 只剩1个方向（强制）
   * - 路口格：有2~4个连接，getNextCells时保留所有连接（含来路）→ 玩家可掉头
   *
   * 路径结构：
   * - 外圈：(0,0)↔(0,1)↔...↔(0,8)↔(1,8)↔...↔(8,8)↔(8,7)↔...↔(8,0)↔(7,0)↔...↔(0,0)
   * - 横轴：(4,0)↔(4,1)↔...↔(4,4)↔...↔(4,8)
   * - 纵轴：(0,4)↔(1,4)↔...↔(4,4)↔...↔(8,4)
   */
  const neighbors = {
    // ===== 上边 row=0 =====
    '0,0': [[0,1], [1,0]],                    // 角落路口：右、下（仅2个连接）
    '0,1': [[0,0], [0,2]],
    '0,2': [[0,1], [0,3]],
    '0,3': [[0,2], [0,4]],
    '0,4': [[0,3], [0,5], [1,4]],             // 路口：左、右、下（纵轴入口）
    '0,5': [[0,4], [0,6]],
    '0,6': [[0,5], [0,7]],
    '0,7': [[0,6], [0,8]],
    '0,8': [[0,7], [1,8]],                    // 角落路口：左、下（仅2个连接）

    // ===== 右边 col=8 =====
    '1,8': [[0,8], [2,8]],
    '2,8': [[1,8], [3,8]],
    '3,8': [[2,8], [4,8]],
    '4,8': [[3,8], [5,8], [4,7]],             // 路口：上、下、左（横轴入口）
    '5,8': [[4,8], [6,8]],
    '6,8': [[5,8], [7,8]],
    '7,8': [[6,8], [8,8]],
    '8,8': [[7,8], [8,7]],                    // 角落路口：上、左（仅2个连接）

    // ===== 下边 row=8 =====
    '8,7': [[8,8], [8,6]],
    '8,6': [[8,7], [8,5]],
    '8,5': [[8,6], [8,4]],
    '8,4': [[8,5], [8,3], [7,4]],             // 路口：右、左、上（纵轴入口）
    '8,3': [[8,4], [8,2]],
    '8,2': [[8,3], [8,1]],
    '8,1': [[8,2], [8,0]],
    '8,0': [[8,1], [7,0]],                    // 角落路口：右、上（仅2个连接）

    // ===== 左边 col=0 =====
    '7,0': [[8,0], [6,0]],
    '6,0': [[7,0], [5,0]],
    '5,0': [[6,0], [4,0]],
    '4,0': [[5,0], [3,0], [4,1]],             // 路口：下、上、右（横轴入口）
    '3,0': [[4,0], [2,0]],
    '2,0': [[3,0], [1,0]],
    '1,0': [[2,0], [0,0]],

    // ===== 纵轴 col=4，row=1~3 =====
    '1,4': [[0,4], [2,4]],
    '2,4': [[1,4], [3,4]],
    '3,4': [[2,4], [4,4]],

    // ===== 纵轴 col=4，row=5~7 =====
    '5,4': [[4,4], [6,4]],
    '6,4': [[5,4], [7,4]],
    '7,4': [[6,4], [8,4]],

    // ===== 横轴 row=4，col=1~3 =====
    '4,1': [[4,0], [4,2]],
    '4,2': [[4,1], [4,3]],
    '4,3': [[4,2], [4,4]],

    // ===== 横轴 row=4，col=5~7 =====
    '4,5': [[4,4], [4,6]],
    '4,6': [[4,5], [4,7]],
    '4,7': [[4,6], [4,8]],

    // ===== 中心路口 (4,4)：四向全连接 =====
    '4,4': [[4,3], [4,5], [3,4], [5,4]]       // 左、右、上、下
  }

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
   * @param {number[]|null} [fromPos=null] — 上一步来自的位置（用于非路口格子排除来路）
   * @returns {number[][]} — 可前进的格子坐标列表
   * @description 返回从当前格子可以前进的方向列表。
   *
   * 规则：
   * - 路口格（休整/比武）：返回该格连接的所有格子，含来路（允许掉头）
   * - 普通格：返回除来路之外的格子（只有1个，强制前进，不可掉头）
   * - fromPos=null（如游戏起点）：路口返回所有连接，普通格返回所有连接
   */
  getNextCells (pos, fromPos = null) {
    const cell = this.cellMap[this.key(pos)]
    if (!cell) return []

    const all = cell.neighbors.map(n => [...n])

    if (cell.isJunction) {
      // 路口：所有方向均可，含掉头
      return all
    }

    // 普通格：排除来路（强制前进）
    if (fromPos) {
      const fromKey = this.key(fromPos)
      const filtered = all.filter(n => this.key(n) !== fromKey)
      // filtered 正常情况只有1个；保险起见如果排除后为空则返回全部
      return filtered.length > 0 ? filtered : all
    }

    return all
  }

  /**
   * @method advanceOneStep
   * @param {number[]} pos — 当前位置
   * @param {number[]|null} [fromPos=null] — 来路（用于普通格排除回头）
   * @param {number} [choiceIndex=0] — 路口时的选择索引
   * @returns {number[]} — 下一格坐标
   * @description 前进一步（模拟器用）。
   */
  advanceOneStep (pos, fromPos = null, choiceIndex = 0) {
    const nexts = this.getNextCells(pos, fromPos)
    if (nexts.length === 0) return pos
    const idx = Math.min(choiceIndex, nexts.length - 1)
    return nexts[idx]
  }

  /**
   * @method advance
   * @param {number[]} startPos — 起始位置
   * @param {number} steps — 前进步数
   * @param {number[]|null} [prevPos=null] — 上一步来自的位置（用于第一步排除来路）
   * @param {number[]} [choices=[]] — 路口选择序列（索引列表，模拟器用）
   * @returns {{ pos: number[], prevPos: number[], passedJunctions: Array<{pos:number[], options:number[][]}>}}
   * @description 从 startPos 前进 steps 步。
   *
   * - 普通格：自动前进（排除来路）
   * - 路口格：按 choices[i] 选择（含掉头选项）；choices 未提供时默认取索引0
   *
   * 返回值：
   * - pos: 最终位置
   * - prevPos: 最后一步的来路（供下一次调用传入）
   * - passedJunctions: 途经的路口列表，每项含 { pos, options } 供UI展示选项
   */
  advance (startPos, steps, prevPos = null, choices = []) {
    let pos = [...startPos]
    let prev = prevPos ? [...prevPos] : null
    const passedJunctions = []
    let choiceUsed = 0

    for (let i = 0; i < steps; i++) {
      const nexts = this.getNextCells(pos, prev)
      if (nexts.length === 0) break

      let nextPos
      const cell = this.cellMap[this.key(pos)]

      if (cell && cell.isJunction) {
        // 路口：记录供UI展示，按choices选择
        passedJunctions.push({ pos: [...pos], options: nexts.map(n => [...n]) })
        const choice = choices[choiceUsed] ?? 0
        choiceUsed++
        nextPos = nexts[Math.min(choice, nexts.length - 1)]
      } else {
        // 普通格：唯一方向，自动前进
        nextPos = nexts[0]
      }

      prev = pos
      pos = nextPos
    }

    return { pos, prevPos: prev, passedJunctions }
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
