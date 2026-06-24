/* ---------- scoring (see RESEARCH.md for sources) ---------- */
const SINGLES = [
  { key: "sider", name: "Sider", pts: 1, tilt: 90, glyph: "🐷" },
  { key: "razorback", name: "Razorback", pts: 5, tilt: 180, glyph: "🐷" },
  { key: "trotter", name: "Trotter", pts: 5, tilt: 0, glyph: "🐷" },
  { key: "snouter", name: "Snouter", pts: 10, tilt: -35, glyph: "🐷" },
  { key: "jowler", name: "Leaning Jowler", pts: 15, tilt: 55, glyph: "🐷" },
];
const DOUBLES = [
  { key: "dbl_razorback", name: "Double Razorback", pts: 20, tilt: 180 },
  { key: "dbl_trotter", name: "Double Trotter", pts: 20, tilt: 0 },
  { key: "dbl_snouter", name: "Double Snouter", pts: 40, tilt: -35 },
  { key: "dbl_jowler", name: "Double Jowler", pts: 60, tilt: 55 },
];
const PTS = Object.fromEntries([...SINGLES, ...DOUBLES].map((o) => [o.key, o.pts]).concat([["kissing", 100]]));

/* ---------- rule presets ---------- */
const baseRules = (winCondition, extra = {}) => ({
  startingScore: 0, pigOutPenalty: 0, oinker: "wipeTotal", offTable: "off",
  piggyback: "eliminate", kissingBacon: false, hogCall: false, winCondition, ...extra,
});
const PRESETS = [
  { id: "classic", emoji: "🐖", name: "Classic", desc: "First to 100 — official rules",
    ruleset: baseRules({ type: "targetScore", target: 100 }) },
  { id: "speed", emoji: "⚡", name: "Speed", desc: "First to 50 — quick game",
    ruleset: baseRules({ type: "targetScore", target: 50 }) },
  { id: "marathon", emoji: "🏁", name: "Marathon", desc: "First to 150",
    ruleset: baseRules({ type: "targetScore", target: 150 }) },
  { id: "rounds", emoji: "🔁", name: "10 Rounds", desc: "Most points after 10 rounds",
    ruleset: baseRules({ type: "rounds", rounds: 10 }, { piggyback: "wipeTotal", offTable: "wipeTurn" }) },
  { id: "family", emoji: "🧸", name: "Family", desc: "First to 100 — gentle rules for kids",
    ruleset: baseRules({ type: "targetScore", target: 100 }, { piggyback: "wipeTotal", offTable: "wipeTurn" }) },
  { id: "tournament", emoji: "🎯", name: "Tournament", desc: "Land exactly on 100",
    ruleset: baseRules({ type: "targetScore", target: 100, mustHitExact: true }, { offTable: "wipeTotal" }) },
];

export { SINGLES, DOUBLES, PTS, baseRules, PRESETS };
