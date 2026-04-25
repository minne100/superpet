/**
 * @module load-cards
 * @description 加载卡牌JSON文件。
 * 在Node.js环境下直读文件系统；浏览器环境下由构建工具加载。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * @description 卡牌存放目录
 * 适配：开发时用相对路径，打包后改为绝对路径
 */
const CARDS_DIR = join(__dirname, '../../cards')

/**
 * @function loadCard
 * @param {string} cardId — 卡牌ID（如 "event_003"）
 * @returns {Object} — 卡牌JSON对象
 * @description 加载单张卡牌JSON。缓存结果避免重复读盘。
 */
const cardCache = new Map()

function loadCard (cardId) {
  if (cardCache.has(cardId)) {
    return structuredClone(cardCache.get(cardId))
  }
  const filePath = join(CARDS_DIR, `${cardId}.json`)
  try {
    const data = readFileSync(filePath, 'utf-8')
    const card = JSON.parse(data)
    cardCache.set(cardId, card)
    return structuredClone(card)
  } catch (err) {
    throw new Error(`加载卡牌 ${cardId} 失败: ${err.message}`)
  }
}

/**
 * @function loadCardsByType
 * @param {string} type — 卡牌类型 'move'|'neigong'|'opportunity'|'event'
 * @returns {Object[]} — 卡牌JSON数组
 * @description 加载指定类型的所有卡牌
 */
function loadCardsByType (type) {
  try {
    const files = readdirSync(CARDS_DIR)
    const prefix = type + '_'
    return files
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort()
      .map(f => {
        const cardId = f.replace('.json', '')
        return loadCard(cardId)
      })
  } catch (err) {
    throw new Error(`加载${type}卡牌目录失败: ${err.message}`)
  }
}

/**
 * @function createDeck
 * @param {string} type — 卡牌类型
 * @param {number} [seed] — 随机种子（可选，用于初始洗牌）
 * @returns {Object[]} — 牌堆数组（已洗牌）
 * @description 创建并初始化指定类型的牌堆
 */
function createDeck (type, seed) {
  const cards = loadCardsByType(type)
  return shuffle(cards, seed)
}

/**
 * @function shuffle
 * @param {Array} arr — 待洗牌数组
 * @param {number} [seed] — 随机种子
 * @returns {Array} — 洗牌后的新数组
 * @description Fisher-Yates洗牌，支持确定性种子。
 * 种子由GameEngine的PRNG提供。
 */
function shuffle (arr, seed) {
  const result = [...arr]
  // 如果没有seed，用Math.random
  // 如果有seed，用确定性PRNG
  const rng = seed !== undefined ? seededRandom(seed) : Math.random
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * @function seededRandom
 * @param {number} seed — 种子
 * @returns {function(): number} — 返回[0,1)的确定性随机函数
 * @description 简单的线性同余PRNG，用于确定性洗牌。
 * 注意：GameEngine会使用更可靠的PRNG。
 */
function seededRandom (seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export { loadCard, loadCardsByType, createDeck, shuffle }
