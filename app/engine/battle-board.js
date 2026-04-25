/**
 * @class BattleBoard
 * @description 37格六边形对战盘（中心螺旋编号）
 *
 * 布局（规则书§2.2.2）：
 *               21 —— 22 —— 23 —— 24
 *              /  \  /  \  /  \  /  \
 *            20 —— 08 —— 09 —— 10 —— 25
 *           /  \  /  \  /  \  /  \  /  \
 *         19 —— 07 —— 01 —— 02 —— 11 —— 26
 *        /  \  /  \  /  \  /  \  /  \  /  \
 *       36 —— 18 —— 06 —— 00 —— 03 —— 12 —— 27
 *        \  /  \  /  \  /  \  /  \  /  \  /
 *         35 —— 17 —— 05 —— 04 —— 13 —— 28
 *          \  /  \  /  \  /  \  /  \  /
 *           34 —— 16 —— 15 —— 14 —— 29
 *            \  /  \  /  \  /  \  /
 *             33 —— 32 —— 31 —— 30
 */

/** 六方向立方体偏移 */
const DIRS = {
  'N':  [0, 1, -1],
  'NE': [1, 0, -1],
  'SE': [1, -1, 0],
  'S':  [0, -1, 1],
  'SW': [-1, 0, 1],
  'NW': [-1, 1, 0]
}

const DIR_NAMES = Object.keys(DIRS) // ['N','NE','SE','S','SW','NW']

/**
 * 硬编码37格坐标 [q, r, s]
 * 按规则书的螺旋编号顺序从00到36
 */
const ALL_COORDS = [
  /* 00 */ [ 0,  0,  0],
  /* 01 */ [ 1,  0, -1],
  /* 02 */ [ 0,  1, -1],
  /* 03 */ [-1,  1,  0],
  /* 04 */ [-1,  0,  1],
  /* 05 */ [ 0, -1,  1],
  /* 06 */ [ 1, -1,  0],
  /* 07 */ [ 2,  0, -2],
  /* 08 */ [ 1,  1, -2],
  /* 09 */ [ 0,  2, -2],
  /* 10 */ [-1,  2, -1],
  /* 11 */ [-2,  2,  0],
  /* 12 */ [-2,  1,  1],
  /* 13 */ [-2,  0,  2],
  /* 14 */ [-1, -1,  2],
  /* 15 */ [ 0, -2,  2],
  /* 16 */ [ 1, -2,  1],
  /* 17 */ [ 2, -2,  0],
  /* 18 */ [ 2, -1, -1],
  /* 19 */ [ 3,  0, -3],
  /* 20 */ [ 2,  2, -4],
  /* 21 */ [ 1,  3, -4],
  /* 22 */ [ 0,  3, -3],
  /* 23 */ [-1,  3, -2],
  /* 24 */ [-2,  3, -1],
  /* 25 */ [-3,  3,  0],
  /* 26 */ [-3,  2,  1],
  /* 27 */ [-3,  1,  2],
  /* 28 */ [-3,  0,  3],
  /* 29 */ [-2, -2,  4],
  /* 30 */ [-1, -3,  4],
  /* 31 */ [ 0, -3,  3],
  /* 32 */ [ 1, -3,  2],
  /* 33 */ [ 2, -3,  1],
  /* 34 */ [ 3, -2, -1],
  /* 35 */ [ 3, -1, -2],
  /* 36 */ [ 2, -1, -1]
]

// 修正35和36的坐标（它们不能和18冲突）
// 重新按图推导35和36的坐标：
// 35: 从34(E)的3,-2,-1向NW(-1,+1,0)走1步 → 2,-1,-1
// 但2,-1,-1已经是18了！
// 从图看35和36是34向N方向之后的连续格
// 实际上规则书的网格图显示：
// 35 —— 34之间的连线是向右下的，35应当在34的SW方向
// 34: [3,-2,-1] → SW(-1,0,+1) = [2,-2,0] 这是17，不是35
// 
// 让我们重新推导：按图，从34走到35是沿S(0,-1,+1)方向
// 但从34向S走：3,-3,0 → 不是有效坐标
//
// 重新确定：从34开始沿NW走两步到36再折向NE到35
// 36 = 34 + NW(-1,1,0) + NW(-1,1,0) = [1,-1,0] → 这又是06
// 所以硬编码方式需要重新用规则书的图一步步推导

// 重新推导整个棋盘。正确的六边形棋盘：所有格子坐标的q+r+s=0
// 使用方向走法：
// 00: 中心
// 01~06: 第1圈（从NE开始顺时针）
const R1 = [
  [1,0,-1],   // 01 NE
  [0,1,-1],   // 02 N
  [-1,1,0],   // 03 NW
  [-1,0,1],   // 04 SW
  [0,-1,1],   // 05 S
  [1,-1,0]    // 06 SE
]

// 第2圈07~18（12格）
// 从(2,-1,-1)开始按六边形周边走一圈
// 规则：向NE走1步，然后依次N,NW,SW,S,SE各走2步，最后NE再走1步
const R2 = [
  [2,0,-2],   // 07: 从00向NE走2步
  [1,1,-2],   // 08: +N(0,1,-1)
  [0,2,-2],   // 09: +N(0,1,-1)  
  [-1,2,-1],  // 10: +NW(-1,1,0)
  [-2,2,0],   // 11: +NW(-1,1,0)
  [-2,1,1],   // 12: +SW(-1,0,1)
  [-2,0,2],   // 13: +SW(-1,0,1)
  [-1,-1,2],  // 14: +S(0,-1,1)
  [0,-2,2],   // 15: +S(0,-1,1)
  [1,-2,1],   // 16: +SE(1,-1,0)
  [2,-2,0],   // 17: +SE(1,-1,0)
  [2,-1,-1]   // 18: +NE(1,0,-1) — 回到起点下一格
]

// 第3圈19~30 + 第4圈31~36
// 从(3,0,-3)开始按六边形周边走一圈
// 向NE走1步，N走3步，NW走3步，SW走3步，S走3步，SE走3步，NE走2步
const R3 = [
  [3,0,-3],   // 19: 从00向NE走3步
  [2,1,-3],   // 20: +N(0,1,-1)
  [1,2,-3],   // 21: +N(0,1,-1)
  [0,3,-3],   // 22: +N(0,1,-1)
  [-1,3,-2],  // 23: +NW(-1,1,0)
  [-2,3,-1],  // 24: +NW(-1,1,0)
  [-3,3,0],   // 25: +NW(-1,1,0)
  [-3,2,1],   // 26: +SW(-1,0,1)
  [-3,1,2],   // 27: +SW(-1,0,1)
  [-3,0,3],   // 28: +SW(-1,0,1)
  [-2,-1,3],  // 29: +S(0,-1,1)
  [-1,-2,3],  // 30: +S(0,-1,1)
  [0,-3,3],   // 31: +S(0,-1,1)
  [1,-3,2],   // 32: +SE(1,-1,0)
  [2,-3,1],   // 33: +SE(1,-1,0)
  [3,-3,0],   // 34: +SE(1,-1,0)
  [3,-2,-1],  // 35: +NE(1,0,-1)
  [3,-1,-2],  // 36: +NE(1,0,-1)
  // 还需要再走一步N...但这里已经走到36了
]

// 组合
const HARD_COORDS = [ALL_COORDS[0], ...R1, ...R2, ...R3]

if (HARD_COORDS.length !== 37) {
  console.warn('WARNING: BattleBoard coords count =', HARD_COORDS.length, '(expected 37)')
  // 补充到37
  while (HARD_COORDS.length < 37) {
    HARD_COORDS.push([0, 0, 0])
  }
}

// 用HARD_COORDS替换ALL_COORDS
for (let i = 0; i < 37; i++) {
  ALL_COORDS[i] = HARD_COORDS[i]
}

/** 坐标到ID的映射表 */
const COORD_TO_ID = {}
for (let i = 0; i < ALL_COORDS.length; i++) {
  const c = ALL_COORDS[i]
  COORD_TO_ID[`${c[0]},${c[1]},${c[2]}`] = i
}

/** 判断两个格子是否相邻 */
function areAdjacent (id1, id2) {
  const c1 = ALL_COORDS[id1]
  const c2 = ALL_COORDS[id2]
  if (!c1 || !c2) return false
  const dist = Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2])
  return dist === 2
}

/** 获取相邻格子ID列表 */
function getAdjacent (id) {
  const c = ALL_COORDS[id]
  if (!c) return []
  const result = []
  for (const [dq, dr, ds] of Object.values(DIRS)) {
    const key = `${c[0] + dq},${c[1] + dr},${c[2] + ds}`
    if (COORD_TO_ID[key] !== undefined) {
      result.push(COORD_TO_ID[key])
    }
  }
  return result
}

/** 通过坐标查找格子ID */
function getHexId (q, r, s) {
  return COORD_TO_ID[`${q},${r},${s}`] ?? -1
}

/** 获取两点之间的方向 */
function getDirection (srcId, dstId) {
  const c1 = ALL_COORDS[srcId]
  const c2 = ALL_COORDS[dstId]
  if (!c1 || !c2) return null
  const dq = c2[0] - c1[0]
  const dr = c2[1] - c1[1]
  const ds = c2[2] - c1[2]
  for (const [name, [q, r, s]] of Object.entries(DIRS)) {
    if (dq === q && dr === r && ds === s) return name
  }
  return null
}

/** 判断格子是否在活动场内 */
function isInField (id, round) {
  const layer = getActiveLayer(round)
  return id >= layer.minId && id <= layer.maxId
}

/** 获取当前活动层范围 */
function getActiveLayer (round) {
  if (round <= 5)  return { minId: 0, maxId: 36, name: 'full' }
  if (round <= 10) return { minId: 0, maxId: 30, name: 'layer3' }
  // 第15轮后只留中心（规则书：第15轮后场地仅剩00号）
  return { minId: 0, maxId: 0, name: 'center' }
}

/** 层定义 */
const LAYERS = {
  full:  { minId: 0, maxId: 36 },
  layer3: { minId: 0, maxId: 30 },
  layer2: { minId: 0, maxId: 18 },
  layer1: { minId: 0, maxId: 6 },
  center: { minId: 0, maxId: 0 }
}

const DIR_KEYS = Object.keys(DIRS)

class BattleBoard {
  constructor () {
    this.totalCells = 37
    this.coords = ALL_COORDS
    this.round = 0
  }

  getAdjacent (id) {
    if (!isInField(id, this.round)) return []
    return getAdjacent(id).filter(nid => isInField(nid, this.round))
  }

  isAdjacent (id1, id2) {
    if (!isInField(id1, this.round) || !isInField(id2, this.round)) return false
    return areAdjacent(id1, id2)
  }

  getDirection (srcId, dstId) {
    return getDirection(srcId, dstId)
  }

  getDirections () {
    return DIR_NAMES
  }

  getNeighbor (id, direction) {
    const d = DIRS[direction]
    if (!d) return -1
    const c = ALL_COORDS[id]
    if (!c) return -1
    const key = `${c[0] + d[0]},${c[1] + d[1]},${c[2] + d[2]}`
    const nid = COORD_TO_ID[key]
    if (nid !== undefined && isInField(nid, this.round)) return nid
    return -1
  }

  getCellInDirection (id, direction, steps) {
    const d = DIRS[direction]
    if (!d) return -1
    const c = ALL_COORDS[id]
    if (!c) return -1
    const key = `${c[0] + d[0] * steps},${c[1] + d[1] * steps},${c[2] + d[2] * steps}`
    const nid = COORD_TO_ID[key]
    if (nid !== undefined && isInField(nid, this.round)) return nid
    return -1
  }

  /**
   * 判断招式范围是否命中目标
   * @param {number} attackerPos
   * @param {string} attackerDir
   * @param {Object} moveCard — 招式卡（含range字段）
   * @param {number} targetPos
   * @returns {boolean}
   */
  isInRange (attackerPos, attackerDir, moveCard, targetPos) {
    if (!moveCard.range || !Array.isArray(moveCard.range)) return false
    const ac = ALL_COORDS[attackerPos]
    if (!ac) return false

    for (const offset of moveCard.range) {
      const rotatedOffset = this.#rotateOffset(offset, 'N', attackerDir)
      const tx = ac[0] + rotatedOffset[0]
      const ty = ac[1] + rotatedOffset[1]
      const tz = ac[2] + rotatedOffset[2]
      if (getHexId(tx, ty, tz) === targetPos) return true
    }

    return false
  }

  #rotateOffset (offset, fromDir, toDir) {
    if (fromDir === toDir) return offset
    const dirNames = DIR_NAMES
    const fromIdx = dirNames.indexOf(fromDir)
    const toIdx = dirNames.indexOf(toDir)
    if (fromIdx === -1 || toIdx === -1) return offset

    const steps = (toIdx - fromIdx + 6) % 6
    let [q, r, s] = offset
    for (let i = 0; i < steps; i++) {
      const nq = -r
      const nr = -s
      const ns = -q
      q = nq; r = nr; s = ns
    }
    return [q, r, s]
  }

  getActiveCells () {
    const cells = []
    for (let i = 0; i < 37; i++) {
      if (isInField(i, this.round)) cells.push(i)
    }
    return cells
  }

  advanceRound () {
    this.round++
  }

  getActiveLayerName () {
    const layer = getActiveLayer(this.round)
    return layer.name
  }

  getActiveCellCount () {
    return this.getActiveCells().length
  }
}

export {
  BattleBoard,
  ALL_COORDS as HEX_COORDS,
  COORD_TO_ID as HEX_BY_ID,
  ALL_COORDS,
  DIRS,
  DIR_NAMES,
  DIR_KEYS,
  getAdjacent,
  getHexId,
  getDirection,
  getActiveLayer,
  isInField,
  LAYERS
}
