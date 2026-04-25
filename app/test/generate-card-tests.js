/**
 * 卡牌测试生成器
 * 自动为所有卡牌生成测试用例
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 卡牌目录
const CARDS_DIR = path.join(__dirname, '..', '..', 'cards');

// 读取所有卡牌文件
function getAllCards() {
  const cards = [];
  const files = fs.readdirSync(CARDS_DIR);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(CARDS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        const card = JSON.parse(content);
        cards.push(card);
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
      }
    }
  }
  
  return cards;
}

// 按类型分组卡牌
function groupCardsByType(cards) {
  const groups = {
    opportunity: [],
    event: [],
    move: [],
    neigong: []
  };
  
  for (const card of cards) {
    if (groups[card.type]) {
      groups[card.type].push(card);
    }
  }
  
  return groups;
}

// 生成测试文件
function generateTestFile(cards, type) {
  const typeName = {
    opportunity: '机遇卡',
    event: '事件卡',
    move: '招式卡',
    neigong: '内功卡'
  };
  
  const testCases = cards.map(card => {
    return `  // 测试${typeName[type]}: ${card.description}
  it('${card.cardId}: ${card.description}', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('${card.cardId}', currentPlayer);
    assert.ok(result.complete, '${card.cardId} 应执行完成');
  })`;
  }).join('\n\n');
  
  const testContent = `/**
 * ${typeName[type]}测试
 * 自动生成的测试用例
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TestGameEnvironment } from './card-effects.test.js';

describe('${typeName[type]}测试', () => {
  let env;

  beforeEach(() => {
    env = new TestGameEnvironment();
  });

  afterEach(() => {
    env = null;
  });

${testCases}
});
`;
  
  const outputPath = path.join(__dirname, `${type}-cards.test.js`);
  fs.writeFileSync(outputPath, testContent);
  console.log(`Generated test file: ${outputPath}`);
}

// 主函数
function main() {
  console.log('Generating card tests...');
  
  const cards = getAllCards();
  const groupedCards = groupCardsByType(cards);
  
  for (const [type, typeCards] of Object.entries(groupedCards)) {
    if (typeCards.length > 0) {
      console.log(`Generating tests for ${type} cards (${typeCards.length} cards)`);
      generateTestFile(typeCards, type);
    }
  }
  
  console.log('Test generation completed!');
}

// 运行生成器
main();
