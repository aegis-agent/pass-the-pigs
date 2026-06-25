import { PTS, SINGLES, DOUBLES } from "./presets.js";

const activeIds = (g) => g.order.filter((id) => !g.eliminated.includes(id));

function finalizeByScore(g) {
  const act = activeIds(g);
  const max = Math.max(...act.map((id) => g.scores[id]));
  const top = act.filter((id) => g.scores[id] === max);
  // Sudden death: if tied and rule enabled, enter playoff instead of ending
  if (g.ruleset.suddenDeath && top.length > 1) {
    return {
      ...g, status: "suddenDeath", pot: 0, rolls: [],
      suddenDeathPlayers: top, suddenDeathRound: 0,
      suddenDeathTurn: 0, suddenDeathScores: Object.fromEntries(top.map(id => [id, 0]))
    };
  }
  return { ...g, status: "over", pot: 0, rolls: [], winnerId: top[0] ?? null, tie: top.length > 1 };
}

function checkEnd(g) {
  const wc = g.ruleset.winCondition;
  const act = activeIds(g);
  if (g.order.length >= 2 && act.length === 1) return { ...g, status: "over", winnerId: act[0], tie: false };
  if (act.length === 0) return { ...g, status: "over", winnerId: null, tie: true };

  // Win-mode variants for target-score games
  const wm = wc.winMode || "firstTo";
  const reached = g.reachedTarget || [];
  if (wm !== "firstTo" && (wc.type === "targetScore" || wc.type === "targetOrRounds")) {
    if (wm === "lastLoses") {
      // All players except one have reached target → that one loses
      const notReached = act.filter((id) => !reached.includes(id));
      if (notReached.length === 1 && act.length > 1 && reached.length > 0) {
        return { ...g, status: "over", winnerId: null, loserId: notReached[0], tie: false };
      }
    }
    if (wm === "firstN") {
      const need = wc.winCount ?? (g.order.length - 1);
      if (reached.length >= need) {
        // Game over — remaining players lose. Winner is highest score among reached.
        const safe = reached.filter((id) => act.includes(id));
        const maxScore = Math.max(...safe.map((id) => g.scores[id]));
        const topSafe = safe.filter((id) => g.scores[id] === maxScore);
        return { ...g, status: "over", pot: 0, rolls: [], winnerId: topSafe[0] ?? null, tie: topSafe.length > 1, reachedTarget: reached };
      }
    }
    // Don't end on target reached for these modes — continue
  }

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
  const currentRound = Math.floor(g.turnsTaken / n) + 1;
  const nextRound = Math.floor((g.turnsTaken + 1) / n) + 1;
  let roundScores = g.roundScores;
  if (nextRound > currentRound || g.roundScores.length === 0) {
    roundScores = [...g.roundScores, { round: currentRound, scores: { ...g.scores } }];
  }
  return checkEnd({ ...g, turnIndex: idx, pot: 0, rolls: [], pendingHogCall: null, turnsTaken: g.turnsTaken + 1, roundScores });
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
      if (R.pigOutPenalty === null) return g; // ignore — turn continues
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
        const wm = wc.winMode || "firstTo";
        if (wm === "firstTo") {
          if (wc.type === "targetScore" && wc.finishRound) {
            const after = g.turnsTaken + 1, N = g.order.length;
            return endTurn({ ...g, scores, targetReachedAt: g.targetReachedAt ?? Math.ceil(after / N) * N, targetReachedBy: g.targetReachedBy ?? cur });
          }
          return { ...g, scores, pot: 0, rolls: [], status: "over", winnerId: cur, tie: false };
        }
        // lastLoses / firstN: mark as reached, keep playing
        const reachedTarget = [...(g.reachedTarget || []), cur];
        // If everyone has reached, game should end
        if (reachedTarget.length >= g.order.length) {
          return finalizeByScore({ ...g, scores, reachedTarget });
        }
        return endTurn({ ...g, scores, reachedTarget });
      }
      return endTurn({ ...g, scores });
    }
    case "MANUAL_BANK": {
      const amount = a.amount ?? 0;
      const total = g.scores[cur] + amount;
      const hasTarget = wc.type === "targetScore" || wc.type === "targetOrRounds";
      if (hasTarget && wc.mustHitExact && total > wc.target) return endTurn({ ...g });
      const scores = { ...g.scores, [cur]: total };
      const reached = hasTarget && (wc.mustHitExact ? total === wc.target : total >= wc.target);
      if (reached) {
        const wm = wc.winMode || "firstTo";
        if (wm === "firstTo") {
          if (wc.type === "targetScore" && wc.finishRound) {
            const after = g.turnsTaken + 1, N = g.order.length;
            return endTurn({ ...g, scores, targetReachedAt: g.targetReachedAt ?? Math.ceil(after / N) * N, targetReachedBy: g.targetReachedBy ?? cur });
          }
          return { ...g, scores, pot: 0, rolls: [], status: "over", winnerId: cur, tie: false };
        }
        const reachedTarget = [...(g.reachedTarget || []), cur];
        if (reachedTarget.length >= g.order.length) {
          return finalizeByScore({ ...g, scores, reachedTarget });
        }
        return endTurn({ ...g, scores, reachedTarget });
      }
      return endTurn({ ...g, scores });
    }
    case "SET_SCORE":
      return checkEnd({ ...g, scores: { ...g.scores, [a.playerId]: a.score } });
    default: return g;
  }
  // Sudden death: alternate between tied players, each gets one turn to bank
  if (g.status === "suddenDeath" && a.type === "BANK") {
    const sdPlayers = g.suddenDeathPlayers;
    const curSd = sdPlayers[g.suddenDeathTurn % sdPlayers.length];
    const total = (g.suddenDeathScores[curSd] || 0) + g.pot;
    const sdScores = { ...g.suddenDeathScores, [curSd]: total };
    const nextTurn = g.suddenDeathTurn + 1;
    const roundComplete = nextTurn % sdPlayers.length === 0;
    if (roundComplete) {
      // All tied players have gone — check winner
      const maxSd = Math.max(...Object.values(sdScores));
      const topSd = sdPlayers.filter(id => sdScores[id] === maxSd);
      if (topSd.length === 1) {
        return { ...g, status: "over", pot: 0, rolls: [], winnerId: topSd[0], tie: false, suddenDeathScores: sdScores };
      }
      // Still tied — next round
      return { ...g, suddenDeathScores: sdScores, suddenDeathTurn: nextTurn, suddenDeathRound: g.suddenDeathRound + 1, pot: 0, rolls: [] };
    }
    return { ...g, suddenDeathScores: sdScores, suddenDeathTurn: nextTurn, pot: 0, rolls: [] };
  }
}

function newGame(order, ruleset, n = 1) {
  return { n, ruleset, order: [...order],
    scores: Object.fromEntries(order.map((id) => [id, ruleset.startingScore || 0])),
    eliminated: [], turnIndex: 0, pot: 0, rolls: [], turnsTaken: 0,
    targetReachedAt: null, targetReachedBy: null, pendingHogCall: null,
    reachedTarget: [], roundScores: [], status: "playing", winnerId: null, loserId: null, tie: false };
}

const uid = () => Math.random().toString(36).slice(2, 9);
const roundOf = (g) => Math.floor(g.turnsTaken / g.order.length) + 1;

function modeLabel(rs) {
  const wc = rs.winCondition;
  const wm = wc.winMode || "firstTo";
  if (wc.type === "rounds") return `${wc.rounds} rounds · most points`;
  if (wc.type === "targetOrRounds") return `to ${wc.target} or ${wc.rounds} rounds`;
  if (wm === "lastLoses") return `last to ${wc.target} loses${wc.mustHitExact ? " (exact)" : ""}`;
  if (wm === "firstN") {
    const n = wc.winCount ?? (rs.order ? rs.order.length - 1 : 1);
    return `first ${n} to ${wc.target}${wc.mustHitExact ? " (exact)" : ""}`;
  }
  return `first to ${wc.target}${wc.mustHitExact ? " (exact)" : ""}${wc.finishRound ? " · finish round" : ""}`;
}

export { activeIds, finalizeByScore, checkEnd, endTurn, reduceGame, newGame, uid, roundOf, modeLabel };
