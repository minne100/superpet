/**
 * @class GameLogger
 * @description 游戏流程记录器。
 *
 * 以"事件流"的方式记录一局游戏的全部状态变化：
 *   - 每回合：谁投了多少骰子、从哪里走到哪里、路口如何选择
 *   - 格子效果：修炼加了多少攻防、抽到什么卡、卡牌效果怎么执行
 *   - 数值变化：每个操作前后的金币/攻击/防御对比
 *   - 比武（未来扩展）
 *
 * 使用方式：
 *   const logger = new GameLogger()
 *   // 在 Simulator 里传入 logger，Coordinator 每步调用 logger.record(event)
 *   const report = logger.render()  // 格式化字符串
 *
 * 不依赖任何游戏逻辑，只做"收集+格式化"。
 */

/** 格子类型的中文名 */
const CELL_NAMES = {
  rest:        '休整',
  cultivate:   '修炼',
  move:        '招式',
  neigong:     '内功',
  opportunity: '机遇',
  event:       '事件',
  battle:      '比武'
}

/**
 * 玩家显示名称。
 * 开局前用"玩家X"，开局后（选了宠物）从事件记录里查宠物名。
 * render() 里通过 _petMap 动态更新。
 */
const DEFAULT_PLAYER_LABEL = id => `玩家${id}`

export class GameLogger {
  constructor () {
    /** @type {Object[]} 事件列表 */
    this.events = []
    /** @type {number} 当前轮次 */
    this._round = 0
    /** @type {number} 当前回合数 */
    this._turn = 0
  }

  /**
   * @method record
   * @param {Object} event — 事件对象
   * @description 记录一条事件。事件类型见下方 record* 便捷方法。
   */
  record (event) {
    this.events.push(event)
  }

  // ===== 便捷记录方法（Coordinator 调用）=====

  recordGameStart (playerIds, startPositions) {
    this.record({
      type: 'GAME_START',
      playerIds,
      startPositions
    })
  }

  recordHostDeclared (hostId) {
    this.record({ type: 'HOST_DECLARED', hostId })
  }

  recordDeckSeeds (hostId, seeds) {
    this.record({ type: 'DECK_SEEDS', hostId, seeds })
  }

  recordOrderDice (rolls, order) {
    this.record({ type: 'ORDER_DICE', rolls, order })
  }

  recordPetAssignment (order, pets) {
    this.record({
      type: 'PET_ASSIGNMENT',
      assignments: order.map((id, i) => ({ playerId: id, pet: pets[i] }))
    })
  }

  recordTalentDealt (assignments) {
    this.record({ type: 'TALENT_DEALT', assignments })
  }

  recordReshuffle (deckType, seed, issuedBy) {
    this.record({ type: 'RESHUFFLE', deckType, seed, issuedBy })
  }

  recordStartPositions (order, posMap, engine) {
    this.record({
      type: 'START_POSITIONS',
      assignments: order.map(id => ({
        playerId: id,
        pet: engine.getPlayer(id)?.name || id,
        pos: posMap[id]
      }))
    })
  }

  recordTurnStart (round, turnInRound, playerId) {
    this._round = round
    this._turn++
    this.record({
      type: 'TURN_START',
      round,
      turnInRound,
      turn: this._turn,
      playerId
    })
  }

  recordSkipTurn (round, turnInRound, playerId, reason) {
    this._round = round
    this._turn++
    this.record({
      type: 'SKIP_TURN',
      round,
      turnInRound,
      turn: this._turn,
      playerId,
      reason
    })
  }

  recordDice (playerId, value) {
    this.record({
      type: 'DICE',
      playerId,
      value
    })
  }

  recordMove (playerId, fromPos, toPos, cellType, steps, junctions) {
    this.record({
      type: 'MOVE',
      playerId,
      fromPos,
      toPos,
      cellType,
      steps,
      junctions  // [{pos, choiceIdx, chosenDir}]
    })
  }

  recordCellEffect (playerId, cellType, effects, stateBefore, stateAfter) {
    this.record({
      type: 'CELL_EFFECT',
      playerId,
      cellType,
      effects,      // [{desc, ...}]
      before: stateBefore,
      after: stateAfter
    })
  }

  recordGameEnd (rankings) {
    this.record({
      type: 'GAME_END',
      rankings
    })
  }

  // ===== 状态快照工具 =====

  /**
   * @method snapshotPlayer
   * @param {Object} player — Player 实例
   * @returns {Object} 纯数据快照
   */
  snapshotPlayer (player) {
    return {
      id: player.id,
      gold: player.gold,
      attack: player.attack,
      defense: player.defense,
      moveCards: player.hand.move?.length ?? 0,
      neigongCards: player.hand.neigong?.length ?? 0
    }
  }

  /**
   * @method diffState
   * @param {Object} before — 前快照
   * @param {Object} after — 后快照
   * @returns {string[]} 变化描述列表
   */
  diffState (before, after) {
    const diffs = []
    if (after.gold !== before.gold) {
      const d = after.gold - before.gold
      diffs.push(`金币 ${before.gold} → ${after.gold} (${d > 0 ? '+' : ''}${d})`)
    }
    if (after.attack !== before.attack) {
      const d = after.attack - before.attack
      diffs.push(`攻击 ${before.attack} → ${after.attack} (${d > 0 ? '+' : ''}${d})`)
    }
    if (after.defense !== before.defense) {
      const d = after.defense - before.defense
      diffs.push(`防御 ${before.defense} → ${after.defense} (${d > 0 ? '+' : ''}${d})`)
    }
    if (after.moveCards !== before.moveCards) {
      const d = after.moveCards - before.moveCards
      diffs.push(`招式卡 ${before.moveCards} → ${after.moveCards} (${d > 0 ? '+' : ''}${d})`)
    }
    if (after.neigongCards !== before.neigongCards) {
      const d = after.neigongCards - before.neigongCards
      diffs.push(`内功卡 ${before.neigongCards} → ${after.neigongCards} (${d > 0 ? '+' : ''}${d})`)
    }
    return diffs
  }

  // ===== 格式化输出 =====

  /**
   * @method render
   * @returns {string} 完整的格式化游戏流程文本
   */
  render () {
    const lines = []
    const sep = '─'.repeat(60)
    const sepBold = '═'.repeat(60)

    lines.push(sepBold)
    lines.push('  《超级宠物》游戏回放')
    lines.push(sepBold)

    // 玩家名映射：开局前用"玩家X"，PET_ASSIGNMENT 之后更新为宠物名
    const petMap = {}
    const playerLabel = id => petMap[id] || DEFAULT_PLAYER_LABEL(id)

    let currentRound = 0

    for (const ev of this.events) {
      switch (ev.type) {

        case 'HOST_DECLARED': {
          lines.push('')
          lines.push('【开局 — 发起者】')
          lines.push(`  👑 玩家${ev.hostId} 为本局发起者（房主），负责确定洗牌种子`)
          break
        }

        case 'DECK_SEEDS': {
          lines.push('')
          lines.push('【开局 — 洗牌种子（由发起者生成并同步给所有玩家）】')
          lines.push(`  📦 招式卡    种子: ${ev.seeds.move}`)
          lines.push(`  📦 内功卡    种子: ${ev.seeds.neigong}`)
          lines.push(`  📦 机遇卡    种子: ${ev.seeds.opportunity}`)
          lines.push(`  📦 事件卡    种子: ${ev.seeds.event}`)
          lines.push(`  → 所有玩家使用相同种子洗牌，牌池顺序完全一致`)
          break
        }

        case 'ORDER_DICE': {
          lines.push('')
          lines.push('【开局 — 投骰决定跑圈顺序】')
          const rounds = {}
          for (const r of ev.rolls) {
            if (!rounds[r.round]) rounds[r.round] = []
            rounds[r.round].push(r)
          }
          for (const [round, entries] of Object.entries(rounds)) {
            if (Object.keys(rounds).length > 1) {
              lines.push(`  第${round}轮${Number(round) > 1 ? '（平局重投）' : ''}：`)
            }
            for (const r of entries) {
              lines.push(`    🎲 玩家${r.playerId} → ${r.value} 点`)
            }
          }
          lines.push(`  ✅ 跑圈顺序：${ev.order.map(id => `玩家${id}`).join(' → ')}`)
          break
        }

        case 'PET_ASSIGNMENT': {
          lines.push('')
          lines.push('【开局 — 按顺序选择宠物】')
          for (const a of ev.assignments) {
            // 更新名称映射，后续 TURN_START 等事件使用宠物名
            petMap[a.playerId] = a.pet
            lines.push(`  玩家${a.playerId} 选择宠物：${a.pet}`)
          }
          break
        }

        case 'TALENT_DEALT': {
          lines.push('')
          lines.push('【开局 — 天赋卡发放（必须项，每局只能使用一次）】')
          for (const a of ev.assignments) {
            const label = playerLabel(a.playerId)
            const cardNames = a.talentCards.map(c => c.name).join(' + ')
            lines.push(`  ${label}(${a.playerId}) [${a.pet}]  天赋：${cardNames}`)
          }
          break
        }

        case 'START_POSITIONS': {
          lines.push('')
          lines.push('【开局 — 按顺序选择起点（休整格）】')
          for (const a of ev.assignments) {
            lines.push(`  ${a.pet}(${a.playerId}) 出发位置：[${a.pos}]`)
          }
          lines.push('')
          lines.push('  ─ 开局完成，跑圈阶段开始 ─')
          break
        }

        case 'GAME_START': {
          // GAME_START 事件已不再使用（开局信息由上面三个事件记录）
          break
        }

        case 'TURN_START': {
          if (ev.round !== currentRound) {
            currentRound = ev.round
            lines.push('')
            lines.push(`${'━'.repeat(60)}`)
            lines.push(`  第 ${ev.round} 轮`)
            lines.push(`${'━'.repeat(60)}`)
          }
          const label = playerLabel(ev.playerId)
          lines.push('')
          lines.push(`  ▶ ${label}(${ev.playerId}) 的回合 [Turn ${ev.turn}]`)
          break
        }

        case 'SKIP_TURN': {
          if (ev.round !== currentRound) {
            currentRound = ev.round
            lines.push('')
            lines.push(`${'━'.repeat(60)}`)
            lines.push(`  第 ${ev.round} 轮`)
            lines.push(`${'━'.repeat(60)}`)
          }
          const label = playerLabel(ev.playerId)
          lines.push('')
          lines.push(`  ⏭ ${label}(${ev.playerId}) 的回合 [Turn ${ev.turn}] - 被跳过（${ev.reason === 'skip_turn' ? '下回合轮空' : ev.reason}）`)
          break
        }

        case 'DICE': {
          lines.push(`    🎲 ${playerLabel(ev.playerId)} 投骰子 → ${ev.value} 点`)
          break
        }

        case 'MOVE': {
          const cellName = CELL_NAMES[ev.cellType] || ev.cellType
          lines.push(`    🚶 ${playerLabel(ev.playerId)} 前进 ${ev.steps} 步: [${ev.fromPos}] → [${ev.toPos}]  落在【${cellName}格】`)
          if (ev.junctions && ev.junctions.length > 0) {
            for (const j of ev.junctions) {
              lines.push(`       ↳ 路口 [${j.pos}] → 选择方向 [${j.chosenDir}]`)
            }
          }
          break
        }

        case 'CELL_EFFECT': {
          const label2 = playerLabel(ev.playerId)
          const cellName2 = CELL_NAMES[ev.cellType] || ev.cellType
          if (ev.effects && ev.effects.length > 0) {
            for (const eff of ev.effects) {
              lines.push(`    ⚡ ${cellName2}格效果: ${eff.desc}`)
            }
          }
          const diffs = this.diffState(ev.before, ev.after)
          if (diffs.length > 0) {
            lines.push(`    📊 ${label2} 数值变化: ${diffs.join(' | ')}`)
            lines.push(`    📋 ${label2} 当前状态: 金币${ev.after.gold} 攻${ev.after.attack} 防${ev.after.defense} 招式卡×${ev.after.moveCards} 内功卡×${ev.after.neigongCards}`)
          } else {
            lines.push(`    📋 ${label2} 当前状态: 金币${ev.after.gold} 攻${ev.after.attack} 防${ev.after.defense} 招式卡×${ev.after.moveCards} 内功卡×${ev.after.neigongCards} (无变化)`)
          }
          break
        }

        case 'RESHUFFLE': {
          const deckNames = { neigong: '内功', opportunity: '机遇', event: '事件' }
          const name = deckNames[ev.deckType] || ev.deckType
          lines.push(`    🔄 ${name}牌堆已抽空 → 弃牌重洗（种子:${ev.seed}，由 ${playerLabel(ev.issuedBy)} 发出）`)
          break
        }

        case 'GAME_END': {
          lines.push('')
          lines.push(sep)
          lines.push('  【游戏结束 — 最终排名】')
          lines.push(sep)
          for (const r of ev.rankings) {
            const medal = ['🥇', '🥈', '🥉', '  '][Math.min(r.rank - 1, 3)]
            lines.push(`  ${medal} 第${r.rank}名  ${playerLabel(r.id)}(${r.id})  金币:${r.gold}  攻击:${r.attack}  防御:${r.defense}`)
          }
          lines.push(sep)
          break
        }
      }
    }

    lines.push(sepBold)
    lines.push(`  共 ${this._turn} 个回合  ${this.events.filter(e => e.type === 'TURN_START').length} 次行动`)
    lines.push(sepBold)

    return lines.join('\n')
  }
}
