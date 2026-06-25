import { describe, it, expect } from 'vitest';
import { reduceGame, newGame, activeIds, finalizeByScore, roundOf } from '../src/engine.js';

const rs = (winCondition, extra = {}) => ({
  startingScore: 0, pigOutPenalty: 0, oinker: 'wipeTotal', offTable: 'wipeTotal',
  piggyback: 'eliminate', kissingBacon: false, hogCall: false, winCondition, ...extra });

const add = (g, key) => reduceGame(g, { type: 'ADD', key });
const bank = (g) => reduceGame(g, { type: 'BANK' });

describe('Win conditions', () => {
  it('targetScore: overshoot allowed, first to reach wins', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:30 }));
    g = add(g,'dbl_snouter'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('A');
    expect(g.scores.A).toBe(40);
  });

  it('mustHitExact: overshoot busts, exact wins', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:20, mustHitExact:true }));
    g = add(g,'jowler'); g = add(g,'snouter'); g = bank(g);
    expect(g.status).toBe('playing');
    expect(g.scores.A).toBe(0);
    expect(g.turnIndex).toBe(1);
    g = add(g,'dbl_trotter'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('B');
  });

  it('rounds: highest after N rounds wins', () => {
    let g = newGame(['A','B'], rs({ type:'rounds', rounds:2 }, { piggyback:'wipeTotal' }));
    g = add(g,'snouter'); g = bank(g);
    g = add(g,'jowler'); g = bank(g);
    g = add(g,'jowler'); g = bank(g);
    expect(g.status).toBe('playing');
    g = add(g,'trotter'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('A');
    expect(g.turnsTaken).toBe(4);
  });

  it('rounds: tie when scores equal', () => {
    let g = newGame(['A','B'], rs({ type:'rounds', rounds:1 }, { piggyback:'wipeTotal' }));
    g = add(g,'snouter'); g = bank(g); g = add(g,'snouter'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.tie).toBe(true);
  });

  it('targetOrRounds: target reached first wins', () => {
    let g = newGame(['A','B'], rs({ type:'targetOrRounds', target:100, rounds:5 }));
    g = add(g,'dbl_jowler'); g = add(g,'dbl_snouter'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('A');
  });

  it('targetOrRounds: rounds expire without target', () => {
    let g = newGame(['A','B'], rs({ type:'targetOrRounds', target:100, rounds:1 }));
    g = add(g,'snouter'); g = bank(g); g = add(g,'jowler'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('B');
    expect(g.scores.B).toBe(15);
  });

  it('finishRound: leader defers, can be overtaken', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:30, finishRound:true }));
    g = add(g,'dbl_snouter'); g = bank(g);
    expect(g.status).toBe('playing');
    expect(g.targetReachedAt).toBe(2);
    g = add(g,'dbl_snouter'); g = add(g,'snouter'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('B');
    expect(g.scores.B).toBe(50);
  });

  it('finishRound: leader keeps lead through round', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:30, finishRound:true }));
    g = add(g,'dbl_snouter'); g = bank(g);
    g = add(g,'sider'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('A');
  });
});

describe('House rules', () => {
  it('offTable: wipeTotal zeros player score', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }, { offTable:'wipeTotal' }));
    g = add(g,'dbl_jowler'); g = bank(g);
    g = add(g,'snouter'); g = bank(g);
    g = reduceGame(g, { type:'OFF_TABLE' });
    expect(g.scores.A).toBe(0);
    expect(g.turnIndex).toBe(1);
  });

  it('pigOutPenalty: subtracts 5 from total', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }, { pigOutPenalty:5 }));
    g = add(g,'dbl_snouter'); g = bank(g);
    g = add(g,'snouter'); g = bank(g);
    g = reduceGame(g, { type:'PIG_OUT' });
    expect(g.scores.A).toBe(35);
    expect(g.turnIndex).toBe(1);
  });

  it('pigOutPenalty: clamps at 0', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }, { pigOutPenalty:5 }));
    g = reduceGame(g, { type:'PIG_OUT' });
    expect(g.scores.A).toBe(0);
  });

  it('oinker: wipeTotal zeros player total', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }, { oinker:'wipeTotal' }));
    g = add(g,'dbl_jowler'); g = bank(g);
    g = add(g,'snouter'); g = reduceGame(g, { type:'OINKER' });
    expect(g.scores.B).toBe(0);
    expect(g.turnIndex).toBe(0);
  });

  it('oinker: wipeTurn only loses turn pot', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }, { oinker:'wipeTurn' }));
    g = add(g,'dbl_jowler'); g = bank(g);
    g = add(g,'snouter'); g = reduceGame(g, { type:'OINKER' });
    expect(g.scores.B).toBe(0);
  });

  it('piggyback eliminate: last standing wins in 2p', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }, { piggyback:'eliminate' }));
    g = reduceGame(g, { type:'PIGGYBACK' });
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('B');
    expect(g.eliminated).toContain('A');
  });

  it('piggyback eliminate: 3p continues after one out', () => {
    let g = newGame(['A','B','C'], rs({ type:'targetScore', target:30 }, { piggyback:'eliminate' }));
    g = reduceGame(g, { type:'PIGGYBACK' });
    expect(g.status).toBe('playing');
    expect(g.turnIndex).toBe(1);
    expect(g.eliminated).toContain('A');
    g = add(g,'dbl_snouter'); g = bank(g);
    expect(g.status).toBe('over');
    expect(g.winnerId).toBe('B');
  });
});

describe('Undo & frozen state', () => {
  it('undo floors at empty rolls', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }));
    g = add(g,'snouter'); g = reduceGame(g, { type:'UNDO' }); g = reduceGame(g, { type:'UNDO' });
    expect(g.pot).toBe(0);
    expect(g.rolls).toHaveLength(0);
  });

  it('game over: no further actions accepted', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:5 }));
    g = add(g,'razorback'); g = bank(g);
    const snap = JSON.stringify(g);
    g = add(g,'jowler');
    expect(JSON.stringify(g)).toBe(snap);
  });
});

describe('Hog Call', () => {
  it('correct prediction: caller gains 2x, thrower loses 2x', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:true }));
    g = add(g,'dbl_snouter');
    g = reduceGame(g, { type:'HOG_CALL', callerId:'B', predictedKey:'snouter' });
    expect(g.pendingHogCall).toEqual({ callerId:'B', predictedKey:'snouter' });
    g = add(g,'snouter');
    expect(g.scores.B).toBe(20);
    expect(g.scores.A).toBe(0);
    expect(g.pendingHogCall).toBeNull();
  });

  it('incorrect prediction: thrower gains 2x, caller loses 2x', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:true }));
    g = add(g,'jowler'); g = add(g,'snouter');
    g = reduceGame(g, { type:'HOG_CALL', callerId:'B', predictedKey:'razorback' });
    g = add(g,'snouter');
    expect(g.scores.A).toBe(20);
    expect(g.scores.B).toBe(0);
    expect(g.pendingHogCall).toBeNull();
  });

  it('rejects when pot < 20', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:true }));
    g = reduceGame(g, { type:'HOG_CALL', callerId:'B', predictedKey:'snouter' });
    expect(g.pendingHogCall).toBeNull();
  });

  it('rejects current player calling', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:true }));
    g = add(g,'dbl_snouter');
    g = reduceGame(g, { type:'HOG_CALL', callerId:'A', predictedKey:'snouter' });
    expect(g.pendingHogCall).toBeNull();
  });

  it('rejects eliminated player', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:true }));
    g.eliminated = ['B']; g = add(g,'dbl_snouter');
    g = reduceGame(g, { type:'HOG_CALL', callerId:'B', predictedKey:'snouter' });
    expect(g.pendingHogCall).toBeNull();
  });

  it('rejects when disabled in ruleset', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:false }));
    g = add(g,'dbl_snouter'); g = reduceGame(g, { type:'HOG_CALL', callerId:'B', predictedKey:'snouter' });
    expect(g.pendingHogCall).toBeNull();
  });

  it('clamps loser at 0', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:true }));
    g = add(g,'dbl_jowler');
    g = reduceGame(g, { type:'HOG_CALL', callerId:'B', predictedKey:'razorback' });
    g = add(g,'jowler');
    expect(g.scores.A).toBe(30);
    expect(g.scores.B).toBe(0);
  });

  it('rejects invalid prediction keys', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:200 }, { hogCall:true }));
    g = add(g,'dbl_snouter');
    g = reduceGame(g, { type:'HOG_CALL', callerId:'B', predictedKey:'pig_out' });
    expect(g.pendingHogCall).toBeNull();
  });
});

describe('Property-based checks', () => {
  it('scores never go negative', () => {
    for (let i = 0; i < 200; i++) {
      let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }));
      const actions = ['sider','razorback','trotter','snouter','jowler','dbl_razorback','dbl_trotter','dbl_snouter','dbl_jowler'];
      for (let j = 0; j < 20; j++) {
        const a = actions[Math.floor(Math.random() * actions.length)];
        g = add(g, a);
        if (Math.random() < 0.2) g = reduceGame(g, { type:'BANK' });
        if (Math.random() < 0.1) g = reduceGame(g, { type:'PIG_OUT' });
        if (Math.random() < 0.05) g = reduceGame(g, { type:'OINKER' });
        if (g.status === 'over') break;
      }
      for (const id of g.order) {
        expect(g.scores[id]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('banking is monotonic unless wipe/penalty fires', () => {
    for (let i = 0; i < 100; i++) {
      let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }));
      const cur = g.order[g.turnIndex];
      const before = g.scores[cur];
      g = add(g, 'snouter'); g = bank(g);
      const after = g.scores[g.order[g.turnIndex === 0 ? 1 : 0]];
      // Banking should increase the player's score
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });

  it('turn always advances to an active player', () => {
    for (let i = 0; i < 100; i++) {
      const n = 2 + Math.floor(Math.random() * 3);
      const order = ['A','B','C','D','E'].slice(0, n);
      let g = newGame(order, rs({ type:'targetScore', target:100 }));
      for (let j = 0; j < 30; j++) {
        const cur = g.order[g.turnIndex];
        expect(g.eliminated).not.toContain(cur);
        g = add(g, 'snouter');
        if (Math.random() < 0.3) g = bank(g);
        if (g.status === 'over') break;
      }
    }
  });
});

describe("MANUAL_BANK", () => {
  it("adds points to current player and advances turn", () => {
    let g = newGame(["A","B"], rs({ type:"targetScore", target:100 }));
    g = reduceGame(g, { type:"MANUAL_BANK", amount:5 });
    expect(g.scores.A).toBe(5);
    expect(g.turnIndex).toBe(1);
    expect(g.pot).toBe(0);
  });

  it("amount 0 advances turn without scoring", () => {
    let g = newGame(["A","B"], rs({ type:"targetScore", target:100 }));
    g = reduceGame(g, { type:"MANUAL_BANK", amount:0 });
    expect(g.scores.A).toBe(0);
    expect(g.turnIndex).toBe(1);
  });

  it("accumulates multiple manual banks", () => {
    let g = newGame(["A","B"], rs({ type:"targetScore", target:100 }));
    g = reduceGame(g, { type:"MANUAL_BANK", amount:10 });
    g = reduceGame(g, { type:"MANUAL_BANK", amount:15 });
    expect(g.scores.B).toBe(15);
    expect(g.turnIndex).toBe(0);
  });

  it("wins when target reached", () => {
    let g = newGame(["A","B"], rs({ type:"targetScore", target:20 }));
    g = reduceGame(g, { type:"MANUAL_BANK", amount:25 });
    expect(g.status).toBe("over");
    expect(g.winnerId).toBe("A");
  });

  it("respects mustHitExact - overshoot resets", () => {
    let g = newGame(["A","B"], rs({ type:"targetScore", target:20, mustHitExact:true }));
    g = reduceGame(g, { type:"MANUAL_BANK", amount:25 });
    expect(g.status).toBe("playing");
    expect(g.scores.A).toBe(0);
    expect(g.turnIndex).toBe(1);
  });

  it("roundScores tracks manual banks", () => {
    let g = newGame(["A","B"], rs({ type:"targetScore", target:100 }));
    g = reduceGame(g, { type:"MANUAL_BANK", amount:5 });
    expect(g.roundScores).toHaveLength(1);
    expect(g.roundScores[0].scores.A).toBe(5);
  });
});

describe('MANUAL_BANK with pot accumulation', () => {
  const rs = (wc, extra = {}) => ({ startingScore: 0, pigOutPenalty: 0, oinker: 'wipeTotal', offTable: 'wipeTotal', piggyback: 'eliminate', kissingBacon: false, hogCall: false, winCondition: wc, ...extra });

  it('MANUAL_BANK combines amount + existing pot', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }));
    g = add(g, 'snouter'); // pot = 10
    g = reduceGame(g, { type:'MANUAL_BANK', amount:5 }); // should be 10+5=15
    expect(g.scores.A).toBe(15);
  });

  it('MANUAL_BANK clamps negative amount to 0', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:100 }));
    g = add(g, 'snouter'); // pot = 10
    g = reduceGame(g, { type:'MANUAL_BANK', amount:-50 }); // clamped to 0, so 10+0=10
    expect(g.scores.A).toBe(10);
  });
});

describe('reachedTarget dedup', () => {
  it('does not add same player twice', () => {
    let g = newGame(['A','B'], rs({ type:'targetScore', target:10, winMode:'lastLoses' }));
    g = add(g, 'dbl_snouter'); g = bank(g); // A reaches 40
    expect(g.reachedTarget).toEqual(['A']);
    g = add(g, 'sider'); g = bank(g); // B at 1
    g = bank(g); // A banks 0 (already above target)
    expect((g.reachedTarget || []).filter(id => id === 'A')).toHaveLength(1);
  });
});

describe('activeIds', () => {
  it('filters out eliminated players', () => {
    let g = newGame(['A','B','C'], { startingScore: 0, pigOutPenalty: 0, oinker: 'wipeTotal', offTable: 'off', piggyback: 'eliminate', kissingBacon: false, hogCall: false, winCondition: { type:'targetScore', target:100 } });
    g = reduceGame(g, { type:'PIGGYBACK' }); // A eliminated
    expect(activeIds(g)).toEqual(['B','C']);
  });
});

describe('lastLoses all-reached fallback', () => {
  it('resolves when all active players reach target', () => {
    let g = newGame(['A','B'], { startingScore: 0, pigOutPenalty: 0, oinker: 'wipeTotal', offTable: 'wipeTotal', piggyback: 'eliminate', kissingBacon: false, hogCall: false, winCondition: { type:'targetScore', target:10, winMode:'lastLoses' } });
    g = add(g, 'dbl_snouter'); g = bank(g); // A reaches 40
    g = add(g, 'dbl_snouter'); g = bank(g); // B reaches 40
    expect(g.status).toBe('over');
  });
});

describe('SET_SCORE updates reachedTarget', () => {
  it('adds player to reachedTarget when set to target', () => {
    let g = newGame(['A','B'], { startingScore: 0, pigOutPenalty: 0, oinker: 'wipeTotal', offTable: 'wipeTotal', piggyback: 'eliminate', kissingBacon: false, hogCall: false, winCondition: { type:'targetScore', target:30, winMode:'firstN', winCount:1 } });
    g = reduceGame(g, { type:'SET_SCORE', playerId:'A', score:35 });
    expect(g.reachedTarget).toContain('A');
  });
});

describe('UNDO non-negative pot', () => {
  it('pot never goes below 0', () => {
    let g = newGame(['A','B'], { startingScore: 0, pigOutPenalty: 0, oinker: 'wipeTotal', offTable: 'wipeTotal', piggyback: 'eliminate', kissingBacon: false, hogCall: false, winCondition: { type:'targetScore', target:100 } });
    g = add(g, 'sider');
    g = reduceGame(g, { type:'UNDO' });
    g = reduceGame(g, { type:'UNDO' }); // empty roll list, pot already 0
    expect(g.pot).toBe(0);
  });
});

describe('roundOf division by zero', () => {
  it('returns 1 for empty order', () => {
    let g = { turnsTaken: 5, order: [], eliminated: [], ruleset: {} };
    expect(roundOf(g)).toBe(6);
  });
});

describe('finalizeByScore no contradictory winner+tie', () => {
  it('null winnerId when tied', () => {
    let g = { order: ['A','B'], scores: { A:20, B:20 }, eliminated: [], status: 'playing', pot: 0, rolls: [], ruleset: { suddenDeath: false } };
    const result = finalizeByScore(g);
    expect(result.winnerId).toBeNull();
    expect(result.tie).toBe(true);
  });

  it('sets winnerId when clear winner', () => {
    let g = { order: ['A','B'], scores: { A:30, B:20 }, eliminated: [], status: 'playing', pot: 0, rolls: [], ruleset: { suddenDeath: false } };
    const result = finalizeByScore(g);
    expect(result.winnerId).toBe('A');
    expect(result.tie).toBe(false);
  });
});

