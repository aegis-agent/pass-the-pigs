# Pass The Pigs — Rules & Variants Research

Compiled from the sources listed at the bottom. Scoring **values** are facts; prose is paraphrased. This is the reference the engine's presets and `RuleSet` options are derived from.

## Origin & editions
- **Pig Mania!** (1977) — original, designed by David Moffat, published by Recycled Paper Products. The dice are asymmetric "pig" bodies (cousins of knucklebones / shagai), and the game is a commercial dressing of the classic press-your-luck dice game **Pig**.
- Licensed to **Milton Bradley**, renamed **Pass the Pigs**. North-American rights to **Winning Moves Games USA** in 1992; Winning Moves acquired the brand outright in early 2017.
- **Big Pigs** (2016): same poses/rules, ~6" foam pigs, bigger score pad.
- **Pig Party Edition** (2011): 4 sets (8 pigs) + a roll-card deck — *different structure*: players race to roll the position/combo shown on a card to win it; first-roll matches earn a bonus all-eight-pig throw. (Modeled as a separate future mode, not the core scorer.)
- A pure **dice** version also exists (two custom d6 printed with the pig poses).

## Core scoring (one pig on its side scores 0; the other pig scores:)
| Pose | Pts | Land |
|---|---|---|
| Razorback | 5 | on its back, trotters up |
| Trotter | 5 | upright on all four trotters |
| Snouter | 10 | balanced on snout + front trotters |
| Leaning Jowler | 15 | snout + ear + one trotter |

**Both pigs:**
- **Sider** = 1 (both on the same side — both dot-up or both dot-down).
- **Mixed Combo** = sum of the two individual poses (e.g. Razorback + Snouter = 15).
- **Doubles** = quadruple the single (i.e. `(x+x)×2`): Double Razorback 20, Double Trotter 20, Double Snouter 40, Double Leaning Jowler 60.

**Turn-enders / penalties:**
- **Pig Out** — pigs on *opposite* sides (one dot-up, one dot-down): the **turn** score is wiped, pass.
- **Makin' Bacon / Oinker** — pigs *touching* while both rest on the table: the **whole game** score is wiped, pass.
- **Piggyback** — one pig resting *on top* of the other (not touching the table): player is **eliminated** from the game.
- **Mutant** — a pig that lands ambiguously between poses: physically re-thrown (no scoring effect → no button needed in a scorer).

**Standard win:** first to a predetermined total, **usually 100** (reach-or-exceed).

## Variants & house rules (the basis for `RuleSet`)
- **Hog Call** (official advanced rule). Once the active thrower has **≥20 points in the current turn**, any *non-throwing* player may shout **"Sooee!"** before the next throw; first to shout is the caller. They predict the next throw's pose (for a Mixed Combo they must name *both* pigs); they **cannot** call Pig Out, Oinker, or Piggyback. If correct, the caller gains **2× the thrown value** and the thrower loses 2×; if wrong, the caller loses 2× and the thrower gains 2×. No score goes below 0. The thrower keeps control either way.
- **Exact finish** — must land *exactly* on the target; overshoot busts the turn (opponents get to catch up).
- **Target tweaks** — Speed (50), Marathon (150+), or any number.
- **Fixed rounds** — play *N* rounds, **highest total wins** (Richard's "highest after 10 rounds"). Implies no elimination.
- **Pig Out penalty** — Pig Out costs **−5 from total** instead of just zeroing the turn.
- **Off-the-table / "pig abuse"** — a pig that lands on the floor wipes the player's **total** (some groups make it just the turn). *Not in the boxed rules; common house rule. This is Richard's "off table = back to 0".*
- **Oinker severity** — full reset (standard) vs. turn-only (gentler).
- **Piggyback severity** — elimination (official) vs. lose-all (kinder for kids).
- **Kissing Bacon** — house bonus where snouts touching = **+100** (contrast with Oinker, where any touching zeroes you).
- **Target-to-beat** (a CUTwC pub variant) — each player throws to set a score the next must beat; structurally different from the race-to-N model.

## Pose probabilities (single pig)
From Kern (2006), *Journal of Statistics Education* — trap-door roller, n = 11,954. Scores are inversely proportional to likelihood, which is the basis of a future EV/odds helper.

| Pose | % |
|---|---|
| Side (no dot) | 34.9 |
| Side (dot) | 30.2 |
| Razorback | 22.4 |
| Trotter | 8.8 |
| Snouter | 3.0 |
| Leaning Jowler | 0.6 |

## How this maps to the engine
- Reach/exact/rounds/either → `winCondition` tagged union.
- Pig Out penalty, Oinker/Off-table/Piggyback severities, Kissing Bacon → `RuleSet` fields.
- Hog Call and Party Edition are documented in `CONTINUATION.md` as the next mechanics (Hog Call needs a non-current-player interaction; Party Edition is a separate game structure).

## Sources
- Wikipedia — https://en.wikipedia.org/wiki/Pass_the_Pigs
- Winning Moves official rules (2023 PDF) — https://winning-moves.com/images/PTP_Rule_2023.pdf
- UltraBoardGames — https://www.ultraboardgames.com/pass-the-pigs/game-rules.php
- Geeky Hobbies (incl. Hog Call detail) — https://www.geekyhobbies.com/pass-the-pigs-dice-game-rules-and-instructions-for-how-to-play/
- Liquisearch (Kissing Bacon, scoring) — https://www.liquisearch.com/pass_the_pigs/rules/scoring
- CUTwC (off-table "pig abuse", mutant, target-to-beat) — https://cutwc.org/Social/DrinkingGames/PassThePigs.shtml
- Loop Life Academy — https://www.looplifeacademy.com/blog/how-to-play-pass-the-pigs
- Play Party Game (exact-100, Speed, Pig-Out penalty) — https://playpartygame.com/dice-games/pass-the-pigs-rules/
- Kern, J.C. (2006), *Pig Data and Bayesian Inference on Multinomial Probabilities*, JSE 14(3) — https://ww2.amstat.org/publications/jse/v14n3/datasets.kern.html
