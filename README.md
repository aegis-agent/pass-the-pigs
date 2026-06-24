# 🐷 Pass The Pigs — Scorekeeper

A kid-simple, single-device scorekeeper for Pass The Pigs. One tap = one toss; points stack into a turn pot; **Bank** before a Pig Out or Oinker wipes you out. Persistent player roster, custom win conditions, and house rules.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pure-engine unit checks (21 assertions)
npm run build    # production build → dist/
```
No backend, no accounts. State lives in `localStorage` via a one-object adapter (`src/storage.js`).

## What's in the box
- **Win conditions:** first to *N* (reach-or-exceed), land **exactly** on *N*, **most points after *N* rounds**, or **either** (target *or* round cap, whichever first). Optional **finish-the-round** fairness so everyone gets equal turns.
- **House rules:** Pig-Out penalty (−5), Oinker severity (lose all / lose turn), off-the-table (ignore / lose turn / lose all), Piggyback (eliminate / lose all / ignore), Kissing Bacon bonus (+100). Six one-tap presets (Classic, Speed, Marathon, 10 Rounds, Family, Tournament) plus a Customize panel.
- **Roster:** saved players (emoji + colour + win stats); base64 **share codes** to copy a friend group between devices.
- **Sessions:** multiple games, per-session leaderboard, history, native share / clipboard export.
- **Feel:** tactile chunky buttons, pose-tilted pig glyphs, confetti, `prefers-reduced-motion` respected, keyboard focus rings.

## Architecture
```
src/
  engine.js    Pure reducer — all game logic. No React, no I/O. Unit-tested.
  presets.js   Scoring table (SINGLES/DOUBLES/PTS) + RuleSet presets + baseRules.
  storage.js   Persistence adapter (localStorage) + roster share-code codec.
  App.jsx      All UI: screens, primitives, inline-style tokens, theme (C).
  main.jsx     React entry.
  styles.css   Fonts + keyframes/animation classes.
test/
  engine.test.mjs   Runs the engine assertions against src/engine.js.
```

**Design rule:** `engine.js` is a pure `reduceGame(state, action)` with no side effects — the same sequence of actions always yields the same state. That makes it trivially serialisable as an event log (see live-sync in `CONTINUATION.md`) and easy to test. UI never mutates game state directly; it dispatches actions and persists the result.

### Data model
```js
// RuleSet (lives on the session + each game)
{
  startingScore: 0,
  pigOutPenalty: 0,                         // points off TOTAL on Pig Out
  oinker:    "wipeTotal" | "wipeTurn",
  offTable:  "off" | "wipeTurn" | "wipeTotal",
  piggyback: "eliminate" | "wipeTotal" | "off",
  kissingBacon: false,
  winCondition:
      { type: "targetScore", target, mustHitExact?, finishRound? }
    | { type: "rounds", rounds }
    | { type: "targetOrRounds", target, rounds }
}

// gameState
{ n, ruleset, order:[id], scores:{id:n}, eliminated:[id],
  turnIndex, pot, rolls:[{key,pts}], turnsTaken,
  targetReachedAt, targetReachedBy, status:"playing"|"over", winnerId, tie }
```
Actions: `ADD {key,pts}` · `UNDO` · `BANK` · `PIG_OUT` · `OINKER` · `OFF_TABLE` · `PIGGYBACK`.

See **RESEARCH.md** for the rules these encode, and **CONTINUATION.md** for the backlog.

## Feature status
| Area | State |
|---|---|
| Core turn loop, banking, undo | ✅ |
| Win conditions (target/exact/rounds/either, finish-round) | ✅ |
| House rules + presets + customize UI | ✅ |
| Roster, share codes, history, session leaderboard | ✅ |
| Resume in-progress game after reload | ✅ |
| Engine unit tests | ✅ (21) |
| Hog Call | ✅ |
| Live multi-device sync (room codes) | ⏳ spec'd |
| PWA / installable / offline | ⏳ spec'd |
| Odds/EV helper, Party Edition mode | ⏳ spec'd |
