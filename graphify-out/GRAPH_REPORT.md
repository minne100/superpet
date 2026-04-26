# Graph Report - superpet  (2026-04-26)

## Corpus Check
- 33 files · ~102,149 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 262 nodes · 476 edges · 10 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 123 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]

## God Nodes (most connected - your core abstractions)
1. `GameEngine` - 32 edges
2. `CombatSystem` - 24 edges
3. `Board` - 20 edges
4. `GameLogger` - 20 edges
5. `CardInterpreter` - 16 edges
6. `BattleBoard` - 14 edges
7. `Player` - 13 edges
8. `EffectManager` - 12 edges
9. `PlayerAgent` - 10 edges
10. `TurnManager` - 9 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (6): areAdjacent(), BattleBoard, getActiveLayer(), getHexId(), isInField(), CombatSystem

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (2): MockPlayer, GameEngine

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (2): Player, TurnManager

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (1): GameLogger

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (2): TestGameEnvironment, EffectManager

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (1): Board

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (8): main(), generateTestFile(), getAllCards(), groupCardsByType(), main(), SimResult, SimStats, Simulator

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (2): GameBus, PlayerAgent

### Community 8 - "Community 8"
Cohesion: 0.21
Nodes (2): CardInterpreter, loadCard()

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (7): completeSetup(), createDeck(), loadCardsByType(), seededRandom(), shuffle(), makeReadyEngine(), makeEngine()

## Knowledge Gaps
- **Thin community `Community 1`** (39 nodes): `MockPlayer`, `.addCard()`, `.addGold()`, `.constructor()`, `.modifyAttack()`, `.modifyDefense()`, `.removeCard()`, `.removeGold()`, `.#applyEngineAction()`, `.#getEngine()`, `game-engine.js`, `GameEngine`, `.applyAction()`, `.assignStartPositions()`, `.#autoRunBattle()`, `.calcExpression()`, `.#checkGameOver()`, `.constructor()`, `.#createRng()`, `.#dealInitialCards()`, `.#drawCard()`, `.getPlayer()`, `.getResult()`, `.getValidActions()`, `.#handleAdvance()`, `.#handleCombatAction()`, `.#handleConfirm()`, `.#handleNextTurn()`, `.#handleRollDice()`, `.#handleSelectCard()`, `.#handleSelectPlayer()`, `.isGameOver()`, `.#nextSeed()`, `.reshuffleDeck()`, `.#resolveSimpleBattle()`, `.#rollDice()`, `.#startBattlePhase()`, `.#triggerCellEffect()`, `.nextTurn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 2`** (24 nodes): `player.js`, `turn-manager.js`, `.getState()`, `Player`, `.addCard()`, `.addGold()`, `.constructor()`, `.countCards()`, `.getCombatAttack()`, `.getCombatDefense()`, `.hasCardType()`, `.modifyAttack()`, `.modifyDefense()`, `.removeCard()`, `.removeGold()`, `.toJSON()`, `TurnManager`, `.advanceRound()`, `.constructor()`, `.getCurrentPlayer()`, `.init()`, `.isRoundComplete()`, `.setPhase()`, `.toJSON()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 3`** (23 nodes): `DEFAULT_PLAYER_LABEL()`, `GameLogger`, `.constructor()`, `.diffState()`, `.record()`, `.recordCellEffect()`, `.recordDeckSeeds()`, `.recordDice()`, `.recordGameEnd()`, `.recordGameStart()`, `.recordHostDeclared()`, `.recordMove()`, `.recordOrderDice()`, `.recordPetAssignment()`, `.recordReshuffle()`, `.recordSkipTurn()`, `.recordStartPositions()`, `.recordTalentDealt()`, `.recordTurnStart()`, `.render()`, `.snapshotPlayer()`, `game-logger.js`, `.#runCoordinator()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (22 nodes): `TestGameEnvironment`, `.clearEffect()`, `.constructor()`, `.endTurn()`, `.getPlayer()`, `.getPlayerState()`, `.hasEffect()`, `.settleBattle()`, `EffectManager`, `.clear()`, `.clearAll()`, `.constructor()`, `.get()`, `.getFirst()`, `.list()`, `.tick()`, `.tickAll()`, `.toJSON()`, `.use()`, `effect-manager.js`, `.clearWaiters()`, `card-effects.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 5`** (22 nodes): `Board`, `.advance()`, `.advanceOneStep()`, `.bestDirection()`, `.constructor()`, `.getBattleCells()`, `.getCell()`, `.getCellsByType()`, `.getDistance()`, `.getNextCells()`, `.getType()`, `.isBattleCell()`, `.isJunction()`, `.isRestCell()`, `.isValidPos()`, `.key()`, `.parseKey()`, `.scoreDirection()`, `.toJSON()`, `.add()`, `board.js`, `._decideJunction()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (19 nodes): `GameBus`, `.broadcast()`, `.constructor()`, `.send()`, `.unicast()`, `.waitFor()`, `.waitForType()`, `.waitForTypes()`, `PlayerAgent`, `._advance()`, `.constructor()`, `._decideCardChoice()`, `._decideCultivate()`, `._handleCellChoices()`, `._rollDice()`, `.run()`, `._takeTurn()`, `game-bus.js`, `player-agent.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (18 nodes): `.executeCard()`, `CardInterpreter`, `.#completeResult()`, `.constructor()`, `.continueFrom()`, `.#executeAction()`, `.#executeLoop()`, `.#getNodeIdentity()`, `.interpret()`, `.#makeWait()`, `.#processSteps()`, `.#resolveAction()`, `.#resolvePlayerList()`, `.#substituteVar()`, `.toJSON()`, `card-interpreter.js`, `.#handleTriggerCard()`, `loadCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameEngine` connect `Community 1` to `Community 8`, `Community 9`, `Community 2`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Why does `CombatSystem` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._