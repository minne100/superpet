# 《超级宠物》AI 团队定义

## 角色清单

### 角色 1：概念设计师 Agent
| 字段 | 值 |
|---|---|
| Name | Concept Artist Agent |
| Role | Builder |
| Capabilities | 根据文本描述生成概念图、角色立绘、场景图；出图风格：萌酷轻武侠 |
| Output | `/home/lu/superpet/artifacts/concept/` |
| Tools | 需要 image generation API（Gemini / Midjourney / Stable Diffusion） |

### 角色 2：平面设计 Agent
| 字段 | 值 |
|---|---|
| Name | Graphic Design Agent |
| Role | Builder |
| Capabilities | 卡牌模板设计、六边形招式范围图绘制、规则书排版、包装设计 |
| Output | `/home/lu/superpet/artifacts/cards/` |
| Tools | SVG生成、排版指令 |

### 角色 3：资深JS开发工程师 — 小开
| 字段 | 值 |
|---|---|
| Name | 小开 |
| Role | Builder / 开发组长 |
| Capabilities | JS全栈（游戏引擎/Three.js/WebRTC），卡牌引擎解释器、Monte Carlo模拟器、P2P网络层 |
| Output | `/home/lu/superpet/app/` |
| Tools | coding-agent, browser |
| 风格 | 务实、面向前沿、重视可测试性："能动就行，但一定要能测" |

### 角色 4：文案 Agent
| 字段 | 值 |
|---|---|
| Name | Copywriter Agent |
| Role | Builder |
| Capabilities | 规则书润色、众筹页面文案、小红书种草笔记、产品介绍 |
| Output | `/home/lu/superpet/artifacts/docs/` |
| Tools | 文本生成 |

### 角色 5：调研 Agent
| 字段 | 值 |
|---|---|
| Name | Research Agent |
| Role | Builder |
| Capabilities | 桌游工厂调研、材质比价、竞品分析、摩点网众筹策略 |
| Tools | web_search, web_fetch |

### 角色 6：测试 Agent
| 字段 | 值 |
|---|---|
| Name | QA Agent |
| Role | Reviewer |
| Capabilities | 规则逻辑校验、边界条件测试、卡牌效果交叉验证 |
| Tools | 逻辑分析 |

## 模型分配建议
- **Orchestrator**：当前 DeepSeek（高推理）
- **开发 Agent**：coding-agent（需要执行代码）
- **其他 Builder**：当前模型 + 工具扩展

## 任务看板
位于 `/home/lu/superpet/tasks/`
