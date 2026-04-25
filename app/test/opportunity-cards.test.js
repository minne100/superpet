/**
 * 机遇卡测试
 * 自动生成的测试用例
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TestGameEnvironment } from './card-effects.test.js';

describe('机遇卡测试', () => {
  let env;

  beforeEach(() => {
    env = new TestGameEnvironment();
  });

  afterEach(() => {
    env = null;
  });

  // 测试机遇卡: 抽一张招式卡（牌堆空则忽略）
  it('opportunity_001: 抽一张招式卡（牌堆空则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_001', currentPlayer);
    assert.ok(result.complete, 'opportunity_001 应执行完成');
  })

  // 测试机遇卡: 抽一张内功卡（牌堆空则忽略）
  it('opportunity_002: 抽一张内功卡（牌堆空则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_002', currentPlayer);
    assert.ok(result.complete, 'opportunity_002 应执行完成');
  })

  // 测试机遇卡: 获得n金币，n=投骰子数值
  it('opportunity_003: 获得n金币，n=投骰子数值', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_003', currentPlayer);
    assert.ok(result.complete, 'opportunity_003 应执行完成');
  })

  // 测试机遇卡: 丢失n金币（不足则扣为0），n=投骰子数值
  it('opportunity_004: 丢失n金币（不足则扣为0），n=投骰子数值', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_004', currentPlayer);
    assert.ok(result.complete, 'opportunity_004 应执行完成');
  })

  // 测试机遇卡: 再投一次骰子并前进
  it('opportunity_005: 再投一次骰子并前进', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_005', currentPlayer);
    assert.ok(result.complete, 'opportunity_005 应执行完成');
  })

  // 测试机遇卡: 选择丢弃1张招式卡（无则忽略）
  it('opportunity_006: 选择丢弃1张招式卡（无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_006', currentPlayer);
    assert.ok(result.complete, 'opportunity_006 应执行完成');
  })

  // 测试机遇卡: 选择丢弃1张内功卡（无则忽略）
  it('opportunity_007: 选择丢弃1张内功卡（无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_007', currentPlayer);
    assert.ok(result.complete, 'opportunity_007 应执行完成');
  })

  // 测试机遇卡: 下一轮轮空（不投骰、不抽卡）
  it('opportunity_008: 下一轮轮空（不投骰、不抽卡）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_008', currentPlayer);
    assert.ok(result.complete, 'opportunity_008 应执行完成');
  })

  // 测试机遇卡: 下一次修炼效果翻倍
  it('opportunity_009: 下一次修炼效果翻倍', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_009', currentPlayer);
    assert.ok(result.complete, 'opportunity_009 应执行完成');
  })

  // 测试机遇卡: 随机丢弃1张招式卡（无则忽略）
  it('opportunity_010: 随机丢弃1张招式卡（无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_010', currentPlayer);
    assert.ok(result.complete, 'opportunity_010 应执行完成');
  })

  // 测试机遇卡: 随机丢弃1张内功卡（无则忽略）
  it('opportunity_011: 随机丢弃1张内功卡（无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_011', currentPlayer);
    assert.ok(result.complete, 'opportunity_011 应执行完成');
  })

  // 测试机遇卡: 获得n金币（n=投骰子数值），同时选择丢弃一张招式卡或内功卡（无卡则忽略丢弃部分）
  it('opportunity_012: 获得n金币（n=投骰子数值），同时选择丢弃一张招式卡或内功卡（无卡则忽略丢弃部分）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_012', currentPlayer);
    assert.ok(result.complete, 'opportunity_012 应执行完成');
  })

  // 测试机遇卡: 下一轮可自主选择前进1-6格（不投骰）
  it('opportunity_013: 下一轮可自主选择前进1-6格（不投骰）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_013', currentPlayer);
    assert.ok(result.complete, 'opportunity_013 应执行完成');
  })

  // 测试机遇卡: 下一次修炼无效
  it('opportunity_014: 下一次修炼无效', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_014', currentPlayer);
    assert.ok(result.complete, 'opportunity_014 应执行完成');
  })

  // 测试机遇卡: 下一次抽取招式卡时额外多抽1张（牌堆空则忽略）
  it('opportunity_015: 下一次抽取招式卡时额外多抽1张（牌堆空则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_015', currentPlayer);
    assert.ok(result.complete, 'opportunity_015 应执行完成');
  })

  // 测试机遇卡: 丢失n金币（n=投骰子数值），同时抽一张内功卡（牌堆空则忽略抽卡部分）
  it('opportunity_016: 丢失n金币（n=投骰子数值），同时抽一张内功卡（牌堆空则忽略抽卡部分）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_016', currentPlayer);
    assert.ok(result.complete, 'opportunity_016 应执行完成');
  })

  // 测试机遇卡: 原地修炼一次
  it('opportunity_017: 原地修炼一次', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_017', currentPlayer);
    assert.ok(result.complete, 'opportunity_017 应执行完成');
  })

  // 测试机遇卡: 下一次休整时可进行修炼
  it('opportunity_018: 下一次休整时可进行修炼', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_018', currentPlayer);
    assert.ok(result.complete, 'opportunity_018 应执行完成');
  })

  // 测试机遇卡: 下一次抽卡时若不满意可重新抽一次（仅限一次）
  it('opportunity_019: 下一次抽卡时若不满意可重新抽一次（仅限一次）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_019', currentPlayer);
    assert.ok(result.complete, 'opportunity_019 应执行完成');
  })

  // 测试机遇卡: 随机丢弃一张招式卡，抽一张内功卡（各自独立判断是否可行）
  it('opportunity_020: 随机丢弃一张招式卡，抽一张内功卡（各自独立判断是否可行）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_020', currentPlayer);
    assert.ok(result.complete, 'opportunity_020 应执行完成');
  })

  // 测试机遇卡: 随机丢弃一张内功卡，抽一张招式卡
  it('opportunity_021: 随机丢弃一张内功卡，抽一张招式卡', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_021', currentPlayer);
    assert.ok(result.complete, 'opportunity_021 应执行完成');
  })

  // 测试机遇卡: 投骰子大于3则抽一张内功卡
  it('opportunity_022: 投骰子大于3则抽一张内功卡', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_022', currentPlayer);
    assert.ok(result.complete, 'opportunity_022 应执行完成');
  })

  // 测试机遇卡: 投骰子大于3则抽一张招式卡
  it('opportunity_023: 投骰子大于3则抽一张招式卡', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_023', currentPlayer);
    assert.ok(result.complete, 'opportunity_023 应执行完成');
  })

  // 测试机遇卡: 下一轮前进时骰子点数翻倍
  it('opportunity_024: 下一轮前进时骰子点数翻倍', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_024', currentPlayer);
    assert.ok(result.complete, 'opportunity_024 应执行完成');
  })

  // 测试机遇卡: 下一轮前进时骰子点数减半（向下取整）
  it('opportunity_025: 下一轮前进时骰子点数减半（向下取整）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_025', currentPlayer);
    assert.ok(result.complete, 'opportunity_025 应执行完成');
  })

  // 测试机遇卡: 获得n金币（n=投骰子数值），下一轮轮空
  it('opportunity_026: 获得n金币（n=投骰子数值），下一轮轮空', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_026', currentPlayer);
    assert.ok(result.complete, 'opportunity_026 应执行完成');
  })

  // 测试机遇卡: 投骰子大于3则选择丢弃一张内功卡
  it('opportunity_027: 投骰子大于3则选择丢弃一张内功卡', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_027', currentPlayer);
    assert.ok(result.complete, 'opportunity_027 应执行完成');
  })

  // 测试机遇卡: 投骰子大于3则选择丢弃一张招式卡
  it('opportunity_028: 投骰子大于3则选择丢弃一张招式卡', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_028', currentPlayer);
    assert.ok(result.complete, 'opportunity_028 应执行完成');
  })

  // 测试机遇卡: 投骰子大于3则防御力+5（永久）
  it('opportunity_029: 投骰子大于3则防御力+5（永久）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_029', currentPlayer);
    assert.ok(result.complete, 'opportunity_029 应执行完成');
  })

  // 测试机遇卡: 投骰子大于3则攻击力+5（永久）
  it('opportunity_030: 投骰子大于3则攻击力+5（永久）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('opportunity_030', currentPlayer);
    assert.ok(result.complete, 'opportunity_030 应执行完成');
  })
});
