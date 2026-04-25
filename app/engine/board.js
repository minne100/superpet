/**
 * @class Board
 * @description 32格跑道地图的抽象。每格有固定类型和名称，按索引(0-31)访问。
 * 比武格：第8格和第31格，踩中触发比武。
 */
class Board {
  /**
   * @param {Object} [options]
   * @param {number} [options.cellCount=32] — 格子总数
   */
  constructor ({ cellCount = 32 } = {}) {
    /** @type {number} 格子总数（固定32） */
    this.cellCount = cellCount

    /**
     * @type {CellDef[]}
     * @description 32格类型定义，索引对应格子编号
     * 类型：cultivate(修炼), opportunity(机遇), event(事件), move(招式),
     *       neigong(内功), battle(比武), rest(休整)
     */
    this.cells = this.#buildCells()
  }

  /**
   * @method #buildCells
   * @private
   * @returns {CellDef[]} 32格数据
   * @description 根据游戏规则构建32格跑道类型分布
   *
   * 原始规则（从规则书§3.1提取）：
   * 0 休整  1 机遇  2 修炼  3 招式  4 修炼  5 内功  6 修炼  7 招式
   * 8 比武  9 机遇  10 修炼 11 招式 12 机遇 13 内功 14 修炼 15 招式
   * 16 休整 17 机遇 18 修炼 19 招式 20 修炼 21 内功 22 修炼 23 招式
   * 24 机遇 25 内功 26 修炼 27 招式 28 机遇 29 修炼 30 内功 31 比武
   */
  #buildCells () {
    const types = [
      'rest',       // 0
      'opportunity', // 1
      'cultivate',   // 2
      'move',        // 3
      'cultivate',   // 4
      'neigong',     // 5
      'cultivate',   // 6
      'move',        // 7
      'battle',      // 8
      'opportunity', // 9
      'cultivate',   // 10
      'move',        // 11
      'opportunity', // 12
      'neigong',     // 13
      'cultivate',   // 14
      'move',        // 15
      'rest',        // 16
      'opportunity', // 17
      'cultivate',   // 18
      'move',        // 19
      'cultivate',   // 20
      'neigong',     // 21
      'cultivate',   // 22
      'move',        // 23
      'opportunity', // 24
      'neigong',     // 25
      'cultivate',   // 26
      'move',        // 27
      'opportunity', // 28
      'cultivate',   // 29
      'neigong',     // 30
      'battle'       // 31
    ]

    return types.map((type, index) => ({
      index,
      type,
      cellName: this.#getDefaultCellName(type, index)
    }))
  }

  /**
   * @method #getDefaultCellName
   * @private
   * @param {string} type — 格子类型
   * @param {number} index — 格子编号
   * @returns {string} — 默认中文格子名
   * @description 返回格子的本地化key前缀，UI层查i18n获取实际显示文本
   */
  #getDefaultCellName (type, index) {
    const names = {
      'rest': '休整',
      'opportunity': '机遇',
      'cultivate': '修炼',
      'move': '招式',
      'neigong': '内功',
      'battle': '比武'
    }
    return names[type] || `格子${index}`
  }

  // ============ 查询方法 ============

  /**
   * @method getCell
   * @param {number} index — 格子编号(0-31)
   * @returns {CellDef} — 格子定义
   * @description 获取指定编号的格子信息
   */
  getCell (index) {
    const idx = this.#normalizeIndex(index)
    return { ...this.cells[idx] }
  }

  /**
   * @method getType
   * @param {number} index — 格子编号
   * @returns {string} — 格子类型
   * @description 获取格子类型
   */
  getType (index) {
    return this.cells[this.#normalizeIndex(index)].type
  }

  /**
   * @method advance
   * @param {number} fromIndex — 起始格子编号
   * @param {number} steps — 前进步数（正数前进，负数后退）
   * @returns {number} — 到达的格子编号
   * @description 从startIndex前进steps步，绕圈循环
   */
  advance (fromIndex, steps) {
    const idx = this.#normalizeIndex(fromIndex)
    return this.#normalizeIndex(idx + steps)
  }

  /**
   * @method getDistance
   * @param {number} a — 格子编号A
   * @param {number} b — 格子编号B
   * @returns {number} — 最短距离（带方向：正数表示从A到B向前）
   * @description 计算两格之间的最短距离（绕圈计算）
   * 返回绝对值最小的距离值，确保｜返回｜≤ cellCount/2
   */
  getDistance (a, b) {
    const ia = this.#normalizeIndex(a)
    const ib = this.#normalizeIndex(b)
    let d = ib - ia
    // 检视反方向是否更短
    if (d > this.cellCount / 2) {
      d -= this.cellCount
    } else if (d < -this.cellCount / 2) {
      d += this.cellCount
    }
    return d
  }

  /**
   * @method isBattleCell
   * @param {number} index — 格子编号
   * @returns {boolean}
   * @description 判断是否比武格
   */
  isBattleCell (index) {
    return this.getType(index) === 'battle'
  }

  // ============ 内部工具 ============

  /**
   * @method #normalizeIndex
   * @private
   * @param {number} index — 原始索引
   * @returns {number} — 归一化到[0, cellCount-1]范围内的索引
   * @description 处理负数/越界的循环归位
   */
  #normalizeIndex (index) {
    return ((index % this.cellCount) + this.cellCount) % this.cellCount
  }

  // ============ 序列化 ============

  /**
   * @method toJSON
   * @returns {Object} — 棋盘状态快照（静态数据，主要用于IO）
   */
  toJSON () {
    return {
      cellCount: this.cellCount,
      cells: this.cells.map(c => ({ index: c.index, type: c.type }))
    }
  }
}

/**
 * @typedef {Object} CellDef
 * @property {number} index — 格子编号 (0-31)
 * @property {string} type — 格子类型
 * @property {string} cellName — 格子名称（i18n key前缀）
 */

export { Board }
