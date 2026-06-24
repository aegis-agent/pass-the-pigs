import { PTS, SINGLES, DOUBLES } from "./presets.js";

const activeIds = (g) => g.order.filter((id) => !g.eliminated.includes(id));

function finalizeByScore(g) {
  const act = activeIds(g);
  const max = Math.max(...act.map((id) => g.scores[id]));
  const top = act.filter((id) => g.scores[id] === max);
  return { ...g, status: "over", pot: 0, rolls: [], winnerId: top[0] ?? null, tie: top.length > 1 };
}
function checkEnd(g) {
  const wc = g.ruleset.winCondition;
  const act = activeIds(g);
  if (g.order.length >= 2 && act.length === 1) return { ...g, status: "over", winnerId: act[0], tie: false };
  if (act.length === 0) return { ...g, status: "over", winnerId: null, tie: true };
  if ((wc.type === "rounds" || wc.type === "targetOrRounds") && g.turnsTaken >= wc.rounds * g.order.length)
    return finalizeByScore(g);
  if (wc.type === "targetScore" && wc.finishRound && g.targetReachedAt != null && g.turnsTaken >= g.targetReachedAt)
    return finalizeByScore(g);
  return g;
}
function endTurn(g) {
  const n = g.order.length;
  let idx = g.turnIndex;
  for (let s = 1; s <= n; s++) { const j = (g.turnIndex + s) % n; if (!g.eliminated.includes(g.order[j])) { idx = j; break; } }
  return checkEnd({ ...g, turnIndex: idx, pot: 0, rolls: [], turnsTaken: g.turnsTaken + 1 });
}
function reduceGame(g, a) {
  if (!g || g.status === "over") return g;
  const cur = g.order[g.turnIndex];
  const wc = g.ruleset.winCondition;
  const R = g.ruleset;
  switch (a.type) {
    case "ADD": {
      const pts = a.pts ?? PTS[a.key];
      let next = { ...g, pot: g.pot + pts, rolls: [...g.rolls, { key: a.key, pts }] };
      if (g.pendingHogCall) {
        const { callerId, predictedKey } = g.pendingHogCall;
        const correct = predictedKey === a.key;
        const raw = pts * 2;
        const scores = { ...next.scores };
        if (correct) {
          scores[callerId] = scores[callerId] + raw;
          scores[cur] = Math.max(0, scores[cur] - raw);
        } else {
          scores[cur] = scores[cur] + raw;
          scores[callerId] = Math.max(0, scores[callerId] - raw);
        }
        next = { ...next, scores, pendingHogCall: null };
      }
      return next;
    }
    case "UNDO": {
      if (!g.rolls.length) return g;
      const last = g.rolls[g.rolls.length - 1];
      return { ...g, pot: g.pot - last.pts, rolls: g.rolls.slice(0, -1) };
    }
    case "PIG_OUT": {
      const pen = R.pigOutPenalty || 0;
      const scores = pen ? { ...g.scores, [cur]: Math.max(0, g.scores[cur] - pen) } : g.scores;
      return endTurn({ ...g, scores });
    }
    case "OINKER":    return endTurn(R.oinker === "wipeTurn" ? { ...g } : { ...g, scores: { ...g.scores, [cur]: 0 } });
    case "OFF_TABLE": return endTurn(R.offTable === "wipeTurn" ? { ...g } : { ...g, scores: { ...g.scores, [cur]: 0 } });
    case "HOG_CALL": {
      if (!R.hogCall || g.pot < 20) return g;
      const callerId = a.callerId;
      if (callerId === cur || g.pendingHogCall || g.eliminated.includes(callerId)) return g;
      const validKeys = new Set([...SINGLES.map(s => s.key), ...DOUBLES.map(d => d.key), "kissing"]);
      if (!validKeys.has(a.predictedKey)) return g;
      return { ...g, pendingHogCall: { callerId, predictedKey: a.predictedKey } };
    }
    case "PIGGYBACK":
      if (R.piggyback === "eliminate") return endTurn({ ...g, eliminated: [...g.eliminated, cur] });
      return endTurn({ ...g, scores: { ...g.scores, [cur]: 0 } });
    case "BANK": {
      const total = g.scores[cur] + g.pot;
      const hasTarget = wc.type === "targetScore" || wc.type === "targetOrRounds";
      if (hasTarget && wc.mustHitExact && total > wc.target) return endTurn({ ...g }); // bust
      const scores = { ...g.scores, [cur]: total };
      const reached = hasTarget && (wc.mustHitExact ? total === wc.target : total >= wc.target);
      if (reached) {
        if (wc.type === "targetScore" && wc.finishRound) {
          const after = g.turnsTaken + 1, N = g.order.length;
          return endTurn({ ...g, scores, targetReachedAt: g.targetReachedAt ?? Math.ceil(after / N) * N, targetReachedBy: g.targetReachedBy ?? cur });
        }
        return { ...g, scores, pot: 0, rolls: [], status: "over", winnerId: cur, tie: false };
      }
      return endTurn({ ...g, scores });
    }
    default: return g;
  }
}
function newGame(order, ruleset, n = 1) {
  return { n, ruleset, order: [...order],
    scores: Object.fromEntries(order.map((id) => [id, ruleset.startingScore || 0])),
    eliminated: [], turnIndex: 0, pot: 0, rolls: [], turnsTaken: 0,
    targetReachedAt: null, targetReachedBy: null, pendingHogCall: null, status: "playing", winnerId: null, tie: false };
}
const uid = () => Math.random().toString(36).slice(2, 9);
const roundOf = (g) => Math.floor(g.turnsTaken / g.order.length) + 1;
function modeLabel(rs) {
  const wc = rs.winCondition;
  if (wc.type === "rounds") return `${wc.rounds} rounds · most points`;
  if (wc.type === "targetOrRounds") return `to ${wc.target} or ${wc.rounds} rounds`;
  return `first to ${wc.target}${wc.mustHitExact ? " (exact)" : ""}${wc.finishRound ? " · finish round" : ""}`;
}

export { activeIds, finalizeByScore, checkEnd, endTurn, reduceGame, newGame, uid, roundOf, modeLabel };
