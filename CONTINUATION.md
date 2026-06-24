# Continuation prompt — Pass The Pigs scorekeeper

> Paste this whole file into Claude Code or Codex as the opening prompt. It is self-contained.

## Mission
You're picking up a working **Pass The Pigs** scorekeeper (React + Vite, no backend). It must stay **kid-simple to operate** — a child can run a game on one shared phone — while supporting custom win conditions and house rules for adults. Don't regress that simplicity when adding power features.

## Run it first
```bash
npm install && npm run dev     # http://localhost:5173
npm test                       # 21 pure-engine assertions — keep these green
```

## Conventions you must preserve
1. **`src/engine.js` is pure.** `reduceGame(state, action) -> state`, no I/O, no React, deterministic. All rules live here. Every change ships with assertions in `test/engine.test.mjs`.
2. **Persistence is one object** (`src/storage.js`, async `get/set`). Don't scatter `localStorage` calls through the UI. Swapping this for a backend must be the only change needed to go multiplayer.
3. **Styling is inline-style tokens + `styles.css`** (no Tailwind/CSS-in-JS dep). The colour palette is the `C` object in `App.jsx`. Keep `prefers-reduced-motion` honoured and focus rings intact.
4. **Actions, not mutations.** UI dispatches `ADD/UNDO/BANK/PIG_OUT/OINKER/OFF_TABLE/PIGGYBACK`; it never edits `gameState` in place.

## Data model
RuleSet + gameState + actions are documented in `README.md` (Architecture → Data model). The rules they encode — and every variant found in research — are in `RESEARCH.md`. Read both before changing the engine.

### Engine decisions already made (don't silently change)
- **Reach-or-exceed** target wins immediately on Bank. **Exact** mode: overshoot **busts** (pot discarded, total unchanged, pass).
- **Rounds** end at `turnsTaken === rounds × playerCount`; winner = highest total, `tie:true` if multiple. **Rounds modes assume no elimination** (presets set `piggyback:"wipeTotal"` there). If you support elimination + rounds, define round-counting explicitly and test it.
- **finishRound** (target mode): on first reach, lock a finish line at the next round boundary and keep playing; a later player can overtake; winner = highest at the boundary.
- **Piggyback `eliminate`** removes the player from rotation; last player standing wins outright.

## Backlog (prioritised)

### P1 — Hog Call (official advanced rule)
Full rules in `RESEARCH.md`. Implementation notes:
- Eligible only when `pot >= 20` and it's a *non-current* player calling. Add `RuleSet.hogCall: boolean`.
- New action `HOG_CALL { callerId, predictedKey }` recorded, then the *next* `ADD` resolves it: if `predictedKey` matches, `caller += 2×pts`, `thrower -= 2×pts`; else swap; clamp at 0; thrower keeps the turn. Cannot predict Pig Out/Oinker/Piggyback.
- **UX is the hard part** (a non-active player must act on a shared device). Suggest: a "Hog Call" affordance that opens a quick pose-picker + who's calling, armed for the next toss only. Keep it skippable so casual/kids play is unaffected.
- **Acceptance:** engine tests for correct/incorrect call, clamping, mixed-combo prediction, ineligibility under 20; UI lets a named caller arm and resolve a single throw.

### P1 — Test + CI hardening
- Port `test/engine.test.mjs` to **Vitest**; add property-based checks (scores never negative; banking is monotonic unless a wipe/penalty fires; turn always advances to an active player).
- GitHub Actions: install → `npm test` → build, on PR.
- **Acceptance:** `vitest run` green in CI; coverage on `engine.js` ≥ 90%.

### P2 — Live multi-device sync (room codes)
The pure reducer is already an **event log** — exploit it. A room is `{ ruleset, order, actions[] }`; clients replay actions to derive identical state.
- Simplest robust path on the user's stack: a **Cloudflare Worker + Durable Object** per room (the DO is the authoritative action log + a WebSocket fan-out). Client appends actions, receives broadcasts, replays. Fall back to **Postgres + SSE** if preferred.
- Generate a 4-char room code; `storage.js` gains a `remote` mode behind the same `get/set` shape plus a `subscribe`.
- Handle: late joiners (send full log), optimistic local apply + reconcile, and "host controls roster".
- **Acceptance:** two browsers in the same room see banks/pig-outs within ~300ms; refresh rejoins and replays correctly; offline → reconnect catches up.

### P2 — PWA (installable, offline)
- Add manifest + icons + a service worker (Workbox or hand-rolled). App is already offline-capable logic-wise; cache the shell + fonts.
- **Acceptance:** installable on iOS/Android home screen, launches offline, passes Lighthouse PWA checks.

### P2 — Roll log & whole-turn undo
- Keep `rolls[]` per turn (already present); surface a tiny per-turn history strip and allow undoing a *completed* turn-ender (mis-tap of Pig Out/Oinker). Currently only in-turn `ADD` is undoable.
- **Acceptance:** an accidental Oinker can be reverted before the next player acts; covered by tests.

### P3 — Odds / "should I roll?" helper
- Use the Kern probability table in `RESEARCH.md` to show, on demand, EV of rolling again vs banking the current pot. Keep it opt-in (a small "odds" toggle) so it never clutters kid play.
- **Acceptance:** given a pot, displays P(bust) and EV(next throw); numbers match a Monte-Carlo check in tests.

### P3 — Party Edition mode
- Separate game structure (roll-card deck; race to match a pose/combo — see `RESEARCH.md`). Model as a distinct mode, not a `RuleSet` tweak. Likely its own reducer + screen.

### P3 — Polish
- Sound effects (oink on Pig Out, fanfare on win) with a mute toggle; theme variants; i18n; haptics on mobile; per-player turn timer (optional).

## Definition of done (any feature)
Engine changes are pure + tested; UI degrades gracefully for the casual/kid path; persistence stays behind the adapter; `npm test` and `npm run build` pass; README feature table updated.
