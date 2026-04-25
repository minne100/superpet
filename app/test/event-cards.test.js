/**
 * 事件卡测试
 * 自动生成的测试用例
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TestGameEnvironment } from './card-effects.test.js';

describe('事件卡测试', () => {
  let env;

  beforeEach(() => {
    env = new TestGameEnvironment();
  });

  afterEach(() => {
    env = null;
  });

  // 测试事件卡: 投骰子最小的玩家下一轮轮空
  it('event_001: 投骰子最小的玩家下一轮轮空', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_001', currentPlayer);
    assert.ok(result.complete, 'event_001 应执行完成');
  })

  // 测试事件卡: 投骰子最大的玩家下一轮可投两次骰子
  it('event_002: 投骰子最大的玩家下一轮可投两次骰子', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_002', currentPlayer);
    assert.ok(result.complete, 'event_002 应执行完成');
  })

  // 测试事件卡: 投骰子最大的玩家从最小的玩家处夺取1张招式卡（对方无则忽略）
  it('event_003: 投骰子最大的玩家从最小的玩家处夺取1张招式卡（对方无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_003', currentPlayer);
    assert.ok(result.complete, 'event_003 应执行完成');
  })

  // 测试事件卡: 投骰子最大的玩家从最小的玩家处夺取1张内功卡（对方无则忽略）
  it('event_004: 投骰子最大的玩家从最小的玩家处夺取1张内功卡（对方无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_004', currentPlayer);
    assert.ok(result.complete, 'event_004 应执行完成');
  })

  // 测试事件卡: 投骰子最大的玩家从最小的玩家处夺取6金币（不足则全取）
  it('event_005: 投骰子最大的玩家从最小的玩家处夺取6金币（不足则全取）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_005', currentPlayer);
    assert.ok(result.complete, 'event_005 应执行完成');
  })

  // 测试事件卡: 所有玩家各获得n金币，n=各自投骰子数值
  it('event_006: 所有玩家各获得n金币，n=各自投骰子数值', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_006', currentPlayer);
    assert.ok(result.complete, 'event_006 应执行完成');
  })

  // 测试事件卡: 所有玩家各丢失n金币，n=各自投骰子数值（不足扣为0）
  it('event_007: 所有玩家各丢失n金币，n=各自投骰子数值（不足扣为0）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_007', currentPlayer);
    assert.ok(result.complete, 'event_007 应执行完成');
  })

  // 测试事件卡: 投骰子最大的玩家防御力+10（永久）
  it('event_008: 投骰子最大的玩家防御力+10（永久）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_008', currentPlayer);
    assert.ok(result.complete, 'event_008 应执行完成');
  })

  // 测试事件卡: 投骰子最大的玩家攻击力+10（永久）
  it('event_009: 投骰子最大的玩家攻击力+10（永久）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_009', currentPlayer);
    assert.ok(result.complete, 'event_009 应执行完成');
  })

  // 测试事件卡: 投骰子最小的玩家防御力-10（不足11则降为1）
  it('event_010: 投骰子最小的玩家防御力-10（不足11则降为1）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_010', currentPlayer);
    assert.ok(result.complete, 'event_010 应执行完成');
  })

  // 测试事件卡: 投骰子最小的玩家攻击力-10（不足11则降为1）
  it('event_011: 投骰子最小的玩家攻击力-10（不足11则降为1）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_011', currentPlayer);
    assert.ok(result.complete, 'event_011 应执行完成');
  })

  // 测试事件卡: 所有玩家选择一张招式卡放回牌堆（无则忽略）
  it('event_012: 所有玩家选择一张招式卡放回牌堆（无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_012', currentPlayer);
    assert.ok(result.complete, 'event_012 应执行完成');
  })

  // 测试事件卡: 所有玩家选择一张内功卡放回牌堆（无则忽略）
  it('event_013: 所有玩家选择一张内功卡放回牌堆（无则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_013', currentPlayer);
    assert.ok(result.complete, 'event_013 应执行完成');
  })

  // 测试事件卡: 所有玩家下一轮骰子点数翻倍
  it('event_014: 所有玩家下一轮骰子点数翻倍', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_014', currentPlayer);
    assert.ok(result.complete, 'event_014 应执行完成');
  })

  // 测试事件卡: 所有玩家下一轮骰子点数减半（向下取整）
  it('event_015: 所有玩家下一轮骰子点数减半（向下取整）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_015', currentPlayer);
    assert.ok(result.complete, 'event_015 应执行完成');
  })

  // 测试事件卡: 给下手玩家n金币（n=你的骰子数，不足则给全部）
  it('event_016: 给下手玩家n金币（n=你的骰子数，不足则给全部）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_016', currentPlayer);
    assert.ok(result.complete, 'event_016 应执行完成');
  })

  // 测试事件卡: 从上手玩家处获得n金币（n=你的骰子数，不足则得全部）
  it('event_017: 从上手玩家处获得n金币（n=你的骰子数，不足则得全部）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_017', currentPlayer);
    assert.ok(result.complete, 'event_017 应执行完成');
  })

  // 测试事件卡: 用你的招式卡与下手玩家交换一张内功卡（各自无对应卡则忽略）
  it('event_018: 用你的招式卡与下手玩家交换一张内功卡（各自无对应卡则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_018', currentPlayer);
    assert.ok(result.complete, 'event_018 应执行完成');
  })

  // 测试事件卡: 用你的内功卡与上手玩家交换一张招式卡（各自无对应卡则忽略）
  it('event_019: 用你的内功卡与上手玩家交换一张招式卡（各自无对应卡则忽略）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_019', currentPlayer);
    assert.ok(result.complete, 'event_019 应执行完成');
  })

  // 测试事件卡: 用n金币换取下手玩家的一张招式卡（n=你的骰子数，对方无则跳过）
  it('event_020: 用n金币换取下手玩家的一张招式卡（n=你的骰子数，对方无则跳过）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_020', currentPlayer);
    assert.ok(result.complete, 'event_020 应执行完成');
  })

  // 测试事件卡: 用n金币换取上手玩家的一张内功卡（n=你的骰子数，对方无则跳过）
  it('event_021: 用n金币换取上手玩家的一张内功卡（n=你的骰子数，对方无则跳过）', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_021', currentPlayer);
    assert.ok(result.complete, 'event_021 应执行完成');
  })

  // 测试事件卡: 投骰子大于3的玩家获得5金币
  it('event_022: 投骰子大于3的玩家获得5金币', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_022', currentPlayer);
    assert.ok(result.complete, 'event_022 应执行完成');
  })

  // 测试事件卡: 投骰子大于3的玩家失去5金币
  it('event_023: 投骰子大于3的玩家失去5金币', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_023', currentPlayer);
    assert.ok(result.complete, 'event_023 应执行完成');
  })

  // 测试事件卡: 投骰子大于3的玩家下一次修炼无效
  it('event_024: 投骰子大于3的玩家下一次修炼无效', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_024', currentPlayer);
    assert.ok(result.complete, 'event_024 应执行完成');
  })

  // 测试事件卡: 投骰子大于3的玩家下一次修炼效果翻倍
  it('event_025: 投骰子大于3的玩家下一次修炼效果翻倍', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_025', currentPlayer);
    assert.ok(result.complete, 'event_025 应执行完成');
  })

  // 测试事件卡: 投骰子大于3的玩家下一次不可以抽卡
  it('event_026: 投骰子大于3的玩家下一次不可以抽卡', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_026', currentPlayer);
    assert.ok(result.complete, 'event_026 应执行完成');
  })

  // 测试事件卡: 投骰子大于3的玩家下一轮轮空
  it('event_027: 投骰子大于3的玩家下一轮轮空', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_027', currentPlayer);
    assert.ok(result.complete, 'event_027 应执行完成');
  })

  // 测试事件卡: 所有玩家原地修炼一次
  it('event_028: 所有玩家原地修炼一次', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_028', currentPlayer);
    assert.ok(result.complete, 'event_028 应执行完成');
  })

  // 测试事件卡: 金币多于下手玩家的玩家丢失5金币
  it('event_029: 金币多于下手玩家的玩家丢失5金币', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_029', currentPlayer);
    assert.ok(result.complete, 'event_029 应执行完成');
  })

  // 测试事件卡: 金币少于下手玩家的玩家获得5金币
  it('event_030: 金币少于下手玩家的玩家获得5金币', () => {
    const currentPlayer = 'A';
    const result = env.executeCard('event_030', currentPlayer);
    assert.ok(result.complete, 'event_030 应执行完成');
  })
});
