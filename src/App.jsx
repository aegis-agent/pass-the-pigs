import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Megaphone,
  Crown, Undo2, Share2, Plus, X, ChevronRight, ChevronDown, Trophy, Settings,
  HelpCircle, Home, RotateCcw, Check, Users, ArrowLeft, Trash2, PartyPopper, Copy,
  Target, Repeat, Sliders, Skull, RefreshCw,
} from "lucide-react";
import InstallPrompt from "./InstallPrompt.jsx";
import { reduceGame, newGame, uid, roundOf, modeLabel } from "./engine.js";
import { SINGLES, DOUBLES, PRESETS } from "./presets.js";
import { store, K, encodeRoster, decodeRoster } from "./storage.js";
import "./styles.css";

/* ---------- brand tokens ---------- */
const C = {
  ink: "#2E1F33", inkSoft: "#7A6B7E", cream: "#FFF7F3", card: "#FFFFFF",
  pink: "#F2667F", pinkDeep: "#D94E6B", grass: "#2FA85A", grassDeep: "#1F8044",
  gold: "#F4B740", clay: "#E0623B", brick: "#B23A48", mud: "#8A5A3C", plum: "#6B4FB0", line: "#F0E2E4",
};
const SWATCHES = ["#F2667F", "#4F8FD6", "#2FA85A", "#F4B740", "#8C6BD9", "#E0623B", "#3FA6A0", "#D94E9B"];
const AVATARS = ["🐷", "🐭", "🦊", "🐰", "🐻", "🐸", "🐯", "🐵", "🐱", "🐶", "🦁", "🐮", "🐨", "🐹"];


/* ================================================================== */
export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("home");
  const [roster, setRoster] = useState([]);
  const [history, setHistory] = useState([]);
  const [session, setSession] = useState(null);
  const [modal, setModal] = useState(null);
    const [gameJustFinished, setGameJustFinished] = useState(false);
  const [updateState, setUpdateState] = useState(null); // null | "available" | "activated"
  const updateRegRef = useRef(null);
  const savedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [r, h, a] = await Promise.all([store.get(K.ROSTER), store.get(K.HISTORY), store.get(K.ACTIVE)]);
      setRoster(r || []); setHistory(h || []);
      if (a?.currentGame?.ruleset && a.currentGame.status === "playing") { setSession(a); setView("game"); }
      else if (a?.ruleset) setSession(a);
      setReady(true);
    })();
  }, []);
  // Listen for SW updates
  useEffect(() => {
    window.__ptpOnUpdate?.((event) => {
      if (event.type === "installed" || event.type === "waiting") {
        setUpdateState("available");
        updateRegRef.current = event.reg;
      } else if (event.type === "activated") {
        setUpdateState("activated");
        setTimeout(() => setUpdateState(null), 4000);
      }
    });
  }, []);

  const applyUpdate = () => {
    const reg = updateRegRef.current;
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      // controllerchange event will fire → reload handled there
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const saveRoster = (r) => { setRoster(r); store.set(K.ROSTER, r); };
  const saveActive = (s) => { setSession(s); store.set(K.ACTIVE, s); };
  const clearActive = () => { setSession(null); store.set(K.ACTIVE, null); };
  const byId = (id) => roster.find((p) => p.id === id) || { name: "?", avatar: "🐷", color: C.inkSoft };

  const game = session?.currentGame || null;
  const dispatch = (action) => {
    if (!session?.currentGame) return;
    const next = reduceGame(session.currentGame, action);
    const updated = { ...session, currentGame: next };
    saveActive(updated);
    if (next.status === "over") {
      const gw = { ...session.gameWins };
      if (!next.tie) {
        if (next.winnerId) {
          gw[next.winnerId] = (gw[next.winnerId] || 0) + 1;
        } else if (next.loserId) {
          session.playerIds.forEach((pid) => { if (pid !== next.loserId) gw[pid] = (gw[pid] || 0) + 1; });
        }
      }
      const games = [...session.games, { n: next.n, scores: next.scores, roundScores: next.roundScores || [], suddenDeathScores: next.suddenDeathScores, winnerId: next.tie ? null : next.winnerId, loserId: next.loserId, eliminated: next.eliminated }];
      saveActive({ ...updated, gameWins: gw, gamesPlayed: session.gamesPlayed + 1, games });
      if (session.gamesPlayed === 0) setTimeout(() => setGameJustFinished(true), 500);
      setTimeout(() => setView("over"), 650);
    }
  };
  const startSession = (order, ruleset) => {
    savedRef.current = false;
    saveActive({ id: uid(), date: Date.now(), ruleset, playerIds: order, order,
      gameWins: {}, gamesPlayed: 0, games: [], currentGame: newGame(order, ruleset, 1) });
    setView("game");
  };

  if (!ready) return <Shell><div style={{ ...flexCenter, minHeight: 320, color: C.inkSoft }}>Loading…</div></Shell>;

  return (
    <Shell>
      
      {view === "home" && <HomeScreen roster={roster} session={session} history={history}
        onNew={() => setView("setup")}
        onResume={() => setView(session?.currentGame?.status === "playing" ? "game" : "summary")}
        onRoster={() => setModal("roster")} onRules={() => setModal("rules")} onHistory={() => setView("history")}
        updateState={updateState} applyUpdate={applyUpdate} />}

      {view === "setup" && <SetupScreen roster={roster} saveRoster={saveRoster}
        onBack={() => setView("home")} onManage={() => setModal("roster")} onStart={startSession} />}

      {view === "game" && game && <GameScreen game={game} byId={byId} dispatch={dispatch}
        onMenu={() => setModal("rules")} onQuit={() => { clearActive(); setView("home"); }} />}

      {view === "over" && game && <OverScreen session={session} byId={byId}
        onNext={() => {
          const start = session.games.length % session.order.length;
          const order = session.order.slice(start).concat(session.order.slice(0, start));
          saveActive({ ...session, currentGame: newGame(order, session.ruleset, session.games.length + 1) });
          setView("game");
        }}
        onFinish={() => { finishSession(); setView("summary"); }} />}

      {view === "summary" && session && <SummaryScreen session={session} byId={byId}
        onShare={() => shareSession(session, byId)}
        onRematch={() => startSession(session.order, session.ruleset)}
        onHome={() => { clearActive(); setView("home"); }} />}

      {view === "history" && <HistoryScreen history={history}
        setHistory={(h) => { setHistory(h); store.set(K.HISTORY, h); }} onBack={() => setView("home")} />}

      {modal === "roster" && <RosterModal roster={roster} saveRoster={saveRoster} onClose={() => setModal(null)} />}
      {modal === "rules" && <RulesModal onClose={() => setModal(null)} />}
      <InstallPrompt gameJustFinished={gameJustFinished} />
    </Shell>
  );

  function finishSession() {
    if (savedRef.current) return;
    savedRef.current = true;
    const record = { id: session.id, date: session.date, ruleset: session.ruleset,
      playerIds: session.playerIds, gameWins: session.gameWins, games: session.games,
      players: session.playerIds.map((id) => { const p = byId(id); return { name: p.name, avatar: p.avatar, color: p.color }; }) };
    const h = [record, ...history].slice(0, 40);
    setHistory(h); store.set(K.HISTORY, h);
    const wins = session.gameWins;
    saveRoster(roster.map((p) => session.playerIds.includes(p.id)
      ? { ...p, gamesPlayed: (p.gamesPlayed || 0) + session.games.length, gamesWon: (p.gamesWon || 0) + (wins[p.id] || 0) } : p));
  }
}

/* ---------------- sharing ---------------- */
const leaderboard = (gameWins, ids, byId) =>
  ids.map((id) => ({ id, name: byId(id).name, avatar: byId(id).avatar, wins: gameWins[id] || 0 }))
    .sort((a, b) => b.wins - a.wins);
async function shareSession(session, byId) {
  const lb = leaderboard(session.gameWins, session.playerIds, byId);
  const lines = lb.map((p, i) => `${i === 0 && p.wins > 0 ? "🏆" : `${i + 1}.`} ${p.avatar} ${p.name} — ${p.wins} ${p.wins === 1 ? "win" : "wins"}`);
  const text = `🐷 Pass The Pigs\n${session.games.length} game${session.games.length === 1 ? "" : "s"} · ${modeLabel(session.ruleset)}\n\n${lines.join("\n")}`;
  try { await navigator.clipboard.writeText(text); alert("Results copied to clipboard!"); } catch { alert(text); }
  if (navigator.share && confirm("Share this session via messages?")) {
    try { await navigator.share({ title: "Pass The Pigs", text }); } catch {}
  }
}

/* ================================================================== *
 *  SCREENS
 * ================================================================== */
function Shell({ children }) {
  return (
    <div style={{ background: C.cream, minHeight: "100vh", fontFamily: "Nunito, system-ui, sans-serif", color: C.ink }}>
      <style>{`
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(244,183,64,0.4); } 50% { box-shadow: 0 0 0 8px rgba(244,183,64,0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes popIn { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>{children}</div>
    </div>
  );
}

function HomeScreen({ roster, session, history, onNew, onResume, onRoster, onRules, onHistory, updateState, applyUpdate }) {
  const live = session?.currentGame?.status === "playing";
  const [showImportBanner, setShowImportBanner] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasState = roster.length > 0 || session;
    if (isStandalone && !hasState && !imported) {
      setShowImportBanner(true);
    }
  }, [roster, session, imported]);

  const handleImportState = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const state = JSON.parse(text);
        let count = 0;
        for (const [key, value] of Object.entries(state)) {
          if (key.startsWith('ptp:')) {
            localStorage.setItem(key, value);
            count++;
          }
        }
        setShowImportBanner(false);
        setImported(true);
        // Reload to pick up imported state
        window.location.reload();
      } catch (err) {
        alert('Could not import: ' + err.message);
      }
    };
    input.click();
  };
    const [checking, setChecking] = useState(false);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    const result = await window.__ptpCheckForUpdates?.();
    setChecking(false);
    if (result?.updateAvailable === false && result?.checked) {
      // No update found — silently done
    }
  };

  return (
    <div className="pop">
      {updateState === "available" && (
        <div style={{
          marginBottom: 16, padding: "12px 16px", borderRadius: 16,
          background: "#E3F2FD", border: "1px solid #90CAF9",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1565C0" }}>
            {"🔄 New version available"}
          </div>
          <button onClick={(e) => { e.stopPropagation(); applyUpdate(); }} style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: "#1976D2", color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}>
            Update & restart
          </button>
        </div>
      )}
      {updateState === "activated" && (
        <div style={{
          marginBottom: 16, padding: "10px 16px", borderRadius: 16,
          background: "#E8F5E9", border: "1px solid #A5D6A7",
          textAlign: "center", fontWeight: 700, fontSize: 13, color: "#2E7D32",
        }}>
          {"✅ Updated! Enjoy the latest version."}
        </div>
      )}
      <header style={{ textAlign: "center", marginTop: 28, marginBottom: 28 }}>
        <div style={{ fontSize: 64, lineHeight: 1 }} className="parade">🐷🐷</div>
        <h1 style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 42, color: C.pink, marginTop: 8, letterSpacing: -0.5 }}>Pass The Pigs</h1>
        <p style={{ color: C.inkSoft, fontWeight: 600 }}>Tap the pigs. Bank your points. Win the bacon.</p>
      </header>
      {showImportBanner && (
        <div style={{
          marginBottom: 16, padding: "12px 16px", borderRadius: 16,
          background: "#E8F5E9", border: "1px solid #A5D6A7",
          textAlign: "center",
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#2E7D32", marginBottom: 4 }}>
            {"📱 Installed app detected"}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#33691E", lineHeight: 1.4 }}>
            Import your saved game state to continue where you left off.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={handleImportState} style={{
              padding: "10px 20px", borderRadius: 12, border: "none",
              background: "#4CAF50", color: "#fff", fontWeight: 700, fontSize: 14,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {"📂 Import Save File"}
            </button>
            <button onClick={() => setShowImportBanner(false)} style={{
              padding: "10px 16px", borderRadius: 12, border: "none",
              background: "transparent", color: "#7A6B7E", fontWeight: 600,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {live && <BigButton onClick={onResume} bg={C.gold} fg={C.ink}><RotateCcw size={22} /> Resume game {session.currentGame.n}</BigButton>}
      <BigButton onClick={onNew} bg={C.pink} fg="#fff"><Plus size={24} /> New game</BigButton>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <TileButton onClick={onRoster} icon={<Users size={22} />} label="Players" sub={`${roster.length} saved`} />
        <TileButton onClick={onHistory} icon={<Trophy size={22} />} label="History" sub={`${history.length} session${history.length === 1 ? "" : "s"}`} />
      </div>
            <button onClick={onRules} style={ghostBtn}><HelpCircle size={18} /> How to play</button>
      <button onClick={handleCheckForUpdates} disabled={checking} style={{ ...ghostBtn, opacity: checking ? 0.5 : 1 }}>
        {checking ? <RotateCcw size={16} className="spin" /> : <RefreshCw size={16} />}
        {" "}{checking ? "Checking…" : "Check for updates"}
      </button>
    </div>
  );
}

function SetupScreen({ roster, saveRoster, onBack, onStart, onManage }) {
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState("classic");
  const [ruleset, setRuleset] = useState(() => structuredClone(PRESETS[0].ruleset));
  const [showCustom, setShowCustom] = useState(false);

  const wc = ruleset.winCondition;
  const setWc = (patch) => setRuleset((r) => ({ ...r, winCondition: { ...r.winCondition, ...patch } }));
  const choosePreset = (p) => { setPresetId(p.id); setRuleset(structuredClone(p.ruleset)); };

  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const addPlayer = () => {
    const nm = name.trim(); if (!nm) return;
    const used = new Set(roster.map((p) => p.color));
    const color = SWATCHES.find((c) => !used.has(c)) || SWATCHES[roster.length % SWATCHES.length];
    const np = { id: uid(), name: nm, avatar: AVATARS[roster.length % AVATARS.length], color, gamesPlayed: 0, gamesWon: 0 };
    saveRoster([...roster, np]); setPicked((p) => [...p, np.id]); setName("");
  };
  const setType = (type) => {
    if (type === "targetScore") setRuleset((r) => ({ ...r, winCondition: { type, target: wc.target || 100, mustHitExact: false, finishRound: false } }));
    if (type === "rounds") setRuleset((r) => ({ ...r, winCondition: { type, rounds: wc.rounds || 10 } }));
    if (type === "targetOrRounds") setRuleset((r) => ({ ...r, winCondition: { type, target: wc.target || 100, rounds: wc.rounds || 10 } }));
    setPresetId("custom");
  };
  const touch = () => setPresetId("custom");

  return (
    <div className="pop">
      <TopBar title="New game" onBack={onBack} right={<button onClick={onManage} style={iconBtn}><Settings size={20} /></button>} />

      <SectionLabel>Who's playing? <span style={{ color: C.inkSoft, fontWeight: 600 }}>tap in turn order</span></SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {roster.map((p) => {
          const i = picked.indexOf(p.id), on = i >= 0;
          return (
            <button key={p.id} onClick={() => toggle(p.id)} style={{ ...chip, borderColor: on ? p.color : C.line,
              background: on ? p.color : "#fff", color: on ? "#fff" : C.ink, boxShadow: on ? `0 4px 0 ${shade(p.color)}` : "none" }}>
              <span style={{ fontSize: 20 }}>{p.avatar}</span>{p.name}{on && <span style={orderBadge}>{i + 1}</span>}
            </button>
          );
        })}
        {roster.length === 0 && <p style={{ color: C.inkSoft }}>No players yet — add one below.</p>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder="Add a player…" style={textInput} />
        <button onClick={addPlayer} style={{ ...iconBtn, background: C.pink, color: "#fff", width: 52 }}><Plus size={22} /></button>
      </div>

      <SectionLabel style={{ marginTop: 26 }}>Game mode</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => choosePreset(p)} style={{ ...presetCard,
            borderColor: presetId === p.id ? C.ink : C.line, boxShadow: `0 4px 0 ${presetId === p.id ? C.ink : C.line}` }}>
            <div style={{ fontSize: 22 }}>{p.emoji}</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</div>
            <div style={{ color: C.inkSoft, fontWeight: 600, fontSize: 12, lineHeight: 1.2 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      <button onClick={() => setShowCustom((v) => !v)} style={{ ...ghostBtn, marginTop: 14, justifyContent: "space-between", paddingLeft: 4, paddingRight: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Sliders size={18} /> Customize rules {presetId === "custom" && <span style={tag}>custom</span>}</span>
        <ChevronDown size={18} style={{ transform: showCustom ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>

      {showCustom && (
        <Card style={{ marginTop: 4 }}>
          <CtlRow label="Win condition">
            <Segmented value={wc.type} onChange={setType} options={[
              { v: "targetScore", l: "Reach score" }, { v: "rounds", l: "N rounds" }, { v: "targetOrRounds", l: "Either" }]} />
          </CtlRow>
          {(wc.type === "targetScore" || wc.type === "targetOrRounds") && (
            <CtlRow label="Target score">
              <Stepper value={wc.target} onChange={(v) => { setWc({ target: v }); touch(); }} step={10} min={10} chips={[50, 100, 150]} />
            </CtlRow>
          )}
          {(wc.type === "rounds" || wc.type === "targetOrRounds") && (
            <CtlRow label="Number of rounds">
              <Stepper value={wc.rounds} onChange={(v) => { setWc({ rounds: v }); touch(); }} step={1} min={1} chips={[5, 10, 15]} />
            </CtlRow>
          )}
          {wc.type === "targetScore" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <CheckPill on={!!wc.mustHitExact} onClick={() => { setWc({ mustHitExact: !wc.mustHitExact }); touch(); }} label="Land exactly" />
              <CheckPill on={!!wc.finishRound} onClick={() => { setWc({ finishRound: !wc.finishRound }); touch(); }} label="Finish the round" />
            </div>
          )}
          {(wc.type === "targetScore" || wc.type === "targetOrRounds") && (<>
            <CtlRow label="Win mode">
              <Segmented value={wc.winMode || "firstTo"} onChange={(v) => { setWc({ winMode: v, winCount: v === "firstN" ? (wc.winCount || picked.length - 1) : undefined }); touch(); }}
                options={[{ v: "firstTo", l: "First to wins" }, { v: "lastLoses", l: "Last to loses" }, { v: "firstN", l: "First N safe" }]} />
            </CtlRow>
            {(wc.winMode === "firstN") && (
              <CtlRow label="Safe slots">
                <Stepper value={wc.winCount || picked.length - 1} onChange={(v) => { setWc({ winCount: v }); touch(); }} step={1} min={1} max={Math.max(1, picked.length - 1)} />
              </CtlRow>
            )}
          </>)}
          <CtlRow label="Pig Out">
            <Segmented value={ruleset.pigOutPenalty === null ? "off" : ruleset.pigOutPenalty ? "pen" : "turn"} onChange={(v) => { setRuleset((r) => ({ ...r, pigOutPenalty: v === "off" ? null : v === "pen" ? 5 : 0 })); touch(); }}
              options={[{ v: "off", l: "Ignore" }, { v: "turn", l: "Lose turn" }, { v: "pen", l: "Lose turn −5" }]} />
          </CtlRow>
          <CtlRow label="Oinker (pigs touching)">
            <Segmented value={ruleset.oinker} onChange={(v) => { setRuleset((r) => ({ ...r, oinker: v })); touch(); }}
              options={[{ v: "wipeTotal", l: "Lose everything" }, { v: "wipeTurn", l: "Lose turn" }]} />
          </CtlRow>
          <CtlRow label="Off the table">
            <Segmented value={ruleset.offTable} onChange={(v) => { setRuleset((r) => ({ ...r, offTable: v })); touch(); }}
              options={[{ v: "off", l: "Ignore" }, { v: "wipeTurn", l: "Lose turn" }, { v: "wipeTotal", l: "Lose all" }]} />
          </CtlRow>
          <CtlRow label="Piggyback (one on the other)">
            <Segmented value={ruleset.piggyback} onChange={(v) => { setRuleset((r) => ({ ...r, piggyback: v })); touch(); }}
              options={[{ v: "eliminate", l: "Out of game" }, { v: "wipeTotal", l: "Lose all" }, { v: "off", l: "Ignore" }]} />
          </CtlRow>
          <CtlRow label="Kissing Bacon (snouts touch)">
            <Segmented value={ruleset.kissingBacon ? "on" : "off"} onChange={(v) => { setRuleset((r) => ({ ...r, kissingBacon: v === "on" })); touch(); }}
              options={[{ v: "off", l: "Off" }, { v: "on", l: "Bonus +100" }]} />
          </CtlRow>
          <CtlRow label="Hog Call (predict throws)" hint="Any player can call the next throw before it happens. If they predict correctly, they steal double the points from the roller. If wrong, the roller steals double from them.">
            <Segmented value={ruleset.hogCall ? "on" : "off"} onChange={(v) => { setRuleset((r) => ({ ...r, hogCall: v === "on" })); touch(); }}
              options={[{ v: "off", l: "Off" }, { v: "on", l: "Advanced rule" }]} />
          </CtlRow>
          <CtlRow label="Sudden death tiebreaker" hint="If the game ends in a tie, tied players enter a playoff: each gets one turn to bank points. Highest bank wins. If still tied, repeat.">
            <Segmented value={ruleset.suddenDeath ? "on" : "off"} onChange={(v) => { setRuleset((r) => ({ ...r, suddenDeath: v === "on" })); touch(); }}
              options={[{ v: "off", l: "Off" }, { v: "on", l: "Playoff" }]} />
          </CtlRow>
        </Card>
      )}

      <BigButton disabled={picked.length < 2} onClick={() => onStart(picked, ruleset)}
        bg={picked.length < 2 ? C.line : C.grass} fg={picked.length < 2 ? C.inkSoft : "#fff"} style={{ marginTop: 22 }}>
        {picked.length < 2 ? "Pick at least 2 players" : <>Start game <ChevronRight size={22} /></>}
      </BigButton>
    </div>
  );
}

function GameScreen({ game, byId, dispatch, onMenu, onQuit }) {
  const R = game.ruleset, wc = R.winCondition;
  const curId = game.status === "suddenDeath" ? game.suddenDeathPlayers[game.suddenDeathTurn % game.suddenDeathPlayers.length] : game.order[game.turnIndex];
  const cur = byId(curId);
  const [floats, setFloats] = useState([]);
  const [bump, setBump] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [hogCallOpen, setHogCallOpen] = useState(false);
  const [hogCaller, setHogCaller] = useState(null);
  const [hogPrediction, setHogPrediction] = useState(null);
  const [hogCallResult, setHogCallResult] = useState(null);
  const [manualScore, setManualScore] = useState("");
  const [editingScore, setEditingScore] = useState(null);
  const [showManual] = useState(false); // showManual replaced by always-visible manual section

  const hogEligible = R.hogCall && game.pot >= 20 && !game.pendingHogCall;

  // Track hog call result for animation
  useEffect(() => {
    if (game.pendingHogCall) {
      setHogCallResult("pending");
    } else if (hogCallResult === "pending") {
      setHogCallResult("resolved");
      setTimeout(() => setHogCallResult(null), 2000);
    }
  }, [game.pendingHogCall]);
  const activeNonCur = game.order.filter(id =>
    id !== curId && !game.eliminated.includes(id)
  );

  const armHogCall = () => {
    if (!hogCaller || !hogPrediction) return;
    dispatch({ type: "HOG_CALL", callerId: hogCaller, predictedKey: hogPrediction });
    setHogCallOpen(false);
    setHogCaller(null);
    setHogPrediction(null);
  };

  const add = (o) => {
    dispatch({ type: "ADD", key: o.key, pts: o.pts });
    const id = uid();
    setFloats((f) => [...f, { id, amt: o.pts }]); setBump((b) => b + 1);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 750);
  };
  const projected = game.scores[curId] + game.pot;
  const reaches = (wc.type === "targetScore" || wc.type === "targetOrRounds") &&
    (wc.mustHitExact ? projected === wc.target : projected >= wc.target);

  const wm = wc.winMode || "firstTo";
  const reachedCount = (game.reachedTarget || []).length;
  const header = wc.type === "rounds" ? `round ${Math.min(roundOf(game), wc.rounds)}/${wc.rounds} · most points`
    : wc.type === "targetOrRounds" ? `to ${wc.target} · rd ${Math.min(roundOf(game), wc.rounds)}/${wc.rounds}`
    : wm === "lastLoses" ? `race to ${wc.target} · last loses${wc.mustHitExact ? " (exact)" : ""}${reachedCount > 0 ? ` · ${reachedCount} safe` : ""}`
    : wm === "firstN" ? `first ${wc.winCount || game.order.length - 1} to ${wc.target}${wc.mustHitExact ? " (exact)" : ""}${reachedCount > 0 ? ` · ${reachedCount}/${wc.winCount || game.order.length - 1}` : ""}`
    : `first to ${wc.target}${wc.mustHitExact ? " exactly" : ""}`;

  const dangers = [
    { type: "PIG_OUT", bg: C.clay, title: "Pig Out", sub: R.pigOutPenalty === null ? "ignored" : R.pigOutPenalty ? "lose turn −5" : "lose this turn" },
    { type: "OINKER", bg: C.brick, title: "Oinker", sub: R.oinker === "wipeTurn" ? "lose this turn" : "lose ALL points" },
    ...(R.offTable !== "off" ? [{ type: "OFF_TABLE", bg: C.mud, title: "Off table", sub: R.offTable === "wipeTurn" ? "lose this turn" : "lose ALL points" }] : []),
    ...(R.piggyback !== "off" ? [{ type: "PIGGYBACK", bg: C.plum, title: "Piggyback", sub: R.piggyback === "eliminate" ? "out of game!" : "lose ALL points" }] : []),
  ];

  return (
    <div className="pop">
      {game.status === "suddenDeath" && (
        <div style={{ textAlign: "center", padding: "8px 14px", background: "#FFE066", borderRadius: 14, marginBottom: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: "#8B7300" }}>⚡ Sudden Death · Round {game.suddenDeathRound + 1}</span>
          <span style={{ display: "block", color: C.inkSoft, fontWeight: 600, fontSize: 12, marginTop: 2 }}>
            Tied players take one turn each — highest bank wins
          </span>
        </div>
      )}
      <div style={{ ...flexBetween, marginBottom: 12 }}>
        <div style={{ fontFamily: "Fredoka", fontWeight: 600, color: C.inkSoft }}>
          Round {Math.min(roundOf(game), wc.type === "rounds" ? wc.rounds : 99)} · Game {game.n} · <span style={{ color: C.ink }}>{header}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onMenu} style={iconBtnSm}><HelpCircle size={18} /></button>
          <button onClick={() => setConfirmQuit(true)} style={iconBtnSm}><X size={18} /></button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
        {game.order.map((id, i) => {
          const sdIdx = game.status === "suddenDeath" ? game.suddenDeathPlayers.indexOf(id) : -1;
          const p = byId(id), on = game.status === "suddenDeath" ? (sdIdx >= 0 && sdIdx === game.suddenDeathTurn % game.suddenDeathPlayers.length) : i === game.turnIndex, out = game.eliminated.includes(id);
          const editing = editingScore?.id === id;
          const commitEdit = () => {
            if (editingScore) { const n = parseInt(editingScore.score); if (!isNaN(n) && n >= 0) dispatch({ type: "SET_SCORE", playerId: editingScore.id, score: n }); }
            setEditingScore(null);
          };
          return (
            <div key={id} style={{ flex: "0 0 auto", padding: editing ? "2px 6px" : "6px 12px", borderRadius: 14, fontWeight: 800,
              background: on ? p.color : "#fff", color: on ? "#fff" : C.ink, border: `2px solid ${on ? p.color : C.line}`,
              display: "flex", alignItems: "center", gap: 6, minWidth: editing ? 60 : 84, justifyContent: "center", opacity: out ? 0.45 : 1 }}>
              <span>{out ? "💀" : p.avatar}</span>
              {editing ? (
                <input type="number" autoFocus inputMode="numeric" pattern="[0-9]*"
                  value={editingScore.score} onChange={(e) => setEditingScore({ id, score: e.target.value })}
                  onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingScore(null); }}
                  style={{ width: 48, padding: "2px 4px", borderRadius: 8, border: "none", fontSize: 16, fontFamily: "Fredoka", fontWeight: 700, textAlign: "center", background: "rgba(255,255,255,0.3)", color: "inherit", outline: "none" }} />
              ) : (
                <span onClick={() => !out && setEditingScore({ id, score: String(game.scores[id]) })}
                  style={{ fontFamily: "Fredoka", fontSize: 18, textDecoration: out ? "line-through" : "none", cursor: out ? "default" : "pointer", display: "flex", alignItems: "center", gap: 2 }}>
                  {game.scores[id]}
                  {!out && <span style={{ fontSize: 10, opacity: 0.4 }}>✎</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ position: "relative", background: cur.color, borderRadius: 28, padding: 20, textAlign: "center", color: "#fff", boxShadow: `0 8px 0 ${shade(cur.color)}` }}>
        <div style={{ fontWeight: 800, fontSize: 20, opacity: 0.95 }}>{cur.avatar} {cur.name}</div>
        <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, opacity: 0.8, marginTop: 6 }}>This turn</div>
        <div key={bump} className="potpulse" style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 76, lineHeight: 1 }}>{game.pot}</div>
        {game.rolls.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4, marginTop: 4 }}>
            {game.rolls.map((r, i) => {
              const all = [...SINGLES, ...DOUBLES, { key: "kissing", name: "Kissing Bacon" }];
              const m = all.find(o => o.key === r.key);
              return <span key={i} style={{ background: "rgba(255,255,255,0.25)", borderRadius: 8, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{m ? m.name : r.key} +{r.pts}</span>;
            })}
          </div>
        )}
        <div style={{ fontWeight: 700, opacity: 0.85, fontSize: 14 }}>
          {game.pot === 0 ? "Tap a pig below 🐷" : `Bank → ${projected}${reaches ? " · WINS! 🏆" : ""}`}
        </div>
        {floats.map((f) => (
          <div key={f.id} className="floatup" style={{ position: "absolute", left: "50%", top: 78, transform: "translateX(-50%)", fontFamily: "Fredoka", fontWeight: 700, fontSize: 34, color: "#fff", pointerEvents: "none" }}>+{f.amt}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        {SINGLES.map((o) => <ScoreBtn key={o.key} o={o} onClick={() => add(o)} />)}
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
          <span style={{ height: 2, background: C.line, flex: 1 }} />
          <span style={{ color: C.inkSoft, fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Doubles · both pigs</span>
          <span style={{ height: 2, background: C.line, flex: 1 }} />
        </div>
        {DOUBLES.map((o) => <ScoreBtn key={o.key} o={o} dbl onClick={() => add(o)} />)}
        {R.kissingBacon && (
          <button onClick={() => add({ key: "kissing", pts: 100, name: "Kissing Bacon" })} className="press" style={{ gridColumn: "1 / -1",
            background: "#fff", border: `2px solid ${C.pink}`, borderRadius: 20, padding: "12px", cursor: "pointer", boxShadow: `0 4px 0 ${C.pinkDeep}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>😘🐷</span>
            <span style={{ fontWeight: 800 }}>Kissing Bacon</span>
            <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 22, color: C.pink }}>+100</span>
          </button>
        )}
      </div>

      <BigButton disabled={game.pot === 0} onClick={() => dispatch({ type: "BANK" })}
        bg={game.pot === 0 ? C.line : C.grass} fg={game.pot === 0 ? C.inkSoft : "#fff"} style={{ marginTop: 16 }}>
        <Check size={24} /> {game.pot === 0 ? "Bank" : `Bank ${game.pot} point${game.pot === 1 ? "" : "s"}`}
      </BigButton>

      <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 14, background: C.line, border: `1px dashed ${C.inkSoft}20` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          🐷 Playing with real pigs? Enter the toss result:
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={manualScore} onChange={(e) => setManualScore(e.target.value)}
            inputMode="numeric" pattern="[0-9]*" placeholder="Score"
            onKeyDown={(e) => { if (e.key === "Enter") { const n = parseInt(manualScore); if (!isNaN(n) && n >= 0) { dispatch({ type: "MANUAL_BANK", amount: n }); setManualScore(""); } } }}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.inkSoft}30`,
              fontSize: 15, fontFamily: "Nunito", fontWeight: 600, outline: "none", background: "#fff", color: C.ink }} />
          <button onClick={() => { const n = parseInt(manualScore); if (!isNaN(n) && n >= 0) { dispatch({ type: "MANUAL_BANK", amount: n }); setManualScore(""); } }}
            style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: C.pink, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito", whiteSpace: "nowrap" }}>
            Bank it
          </button>
          <button onClick={() => { dispatch({ type: "MANUAL_BANK", amount: 0 }); }}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.inkSoft}30`, background: "#fff", color: C.inkSoft, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "Nunito", whiteSpace: "nowrap" }}>
            +0
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        {dangers.map((d) => <DangerBtn key={d.type} onClick={() => dispatch({ type: d.type })} bg={d.bg} title={d.title} sub={d.sub} />)}
      </div>
      {hogEligible && activeNonCur.length > 0 && (
        <button onClick={() => setHogCallOpen(true)} style={{
          ...ghostBtn, color: C.gold, background: C.gold + "15",
          border: `2px solid ${C.gold}40`, borderRadius: 14, padding: "10px 16px",
          animation: "pulse 2s infinite", fontWeight: 800
        }}>
          <Megaphone size={18} /> Hog Call — steal double!
        </button>
      )}
      {game.pendingHogCall && (
        <div style={{ textAlign: "center", padding: "8px 14px", background: C.gold + "20", border: `2px solid ${C.gold}`, borderRadius: 14, marginTop: 10 }}>
          <span style={{ fontWeight: 800, color: C.gold }}><Megaphone size={14} /> {byId(game.pendingHogCall.callerId).name} called it!</span>
          <span style={{ color: C.inkSoft, fontWeight: 600, display: "block", fontSize: 13 }}>Predicting: {(() => { const all = [...SINGLES, ...DOUBLES]; const m = all.find(o => o.key === game.pendingHogCall.predictedKey); return m ? m.name : game.pendingHogCall.predictedKey; })()}</span>
        </div>
      )}
      <button onClick={() => dispatch({ type: "UNDO" })} disabled={!game.rolls.length} style={{ ...ghostBtn, opacity: game.rolls.length ? 1 : 0.4 }}>
        <Undo2 size={18} /> Undo last
      </button>

      {hogCallOpen && (
        <Sheet onClose={() => { setHogCallOpen(false); setHogCaller(null); setHogPrediction(null); }} title="Hog Call — predict the next throw">
          <p style={{ color: C.inkSoft, marginBottom: 14 }}>Pot is {game.pot} pts. Who's calling, and what will {cur.name} throw next?</p>

          <SectionLabel>Who's calling?</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {activeNonCur.map(id => {
              const p = byId(id);
              return (
                <button key={id} onClick={() => setHogCaller(id)} style={{
                  padding: "10px 14px", borderRadius: 14, border: `2px solid ${hogCaller === id ? p.color : C.line}`,
                  background: hogCaller === id ? p.color : "#fff", color: hogCaller === id ? "#fff" : C.ink,
                  fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
                }}>{p.avatar} {p.name}</button>
              );
            })}
          </div>

          <SectionLabel>Predict the pose</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[...SINGLES, ...DOUBLES].map(o => (
              <button key={o.key} onClick={() => setHogPrediction(o.key)} style={{
                padding: "10px", borderRadius: 14, border: `2px solid ${hogPrediction === o.key ? C.gold : C.line}`,
                background: hogPrediction === o.key ? C.gold + "20" : "#fff", cursor: "pointer", textAlign: "left"
              }}>
                <span style={{ fontWeight: 800, display: "block" }}>{o.name}</span>
                <span style={{ color: C.inkSoft, fontWeight: 600, fontSize: 13 }}>+{o.pts}</span>
              </button>
            ))}
            {R.kissingBacon && (
              <button key="kissing" onClick={() => setHogPrediction("kissing")} style={{
                padding: "10px", borderRadius: 14, border: `2px solid ${hogPrediction === "kissing" ? C.gold : C.line}`,
                background: hogPrediction === "kissing" ? C.gold + "20" : "#fff", cursor: "pointer", textAlign: "left"
              }}><span style={{ fontWeight: 800 }}>Kissing Bacon</span><span style={{ color: C.inkSoft, fontWeight: 600, fontSize: 13, display: "block" }}>+100</span></button>
            )}
          </div>

          <BigButton disabled={!hogCaller || !hogPrediction} onClick={armHogCall}
            bg={hogCaller && hogPrediction ? C.gold : C.line} fg={hogCaller && hogPrediction ? C.ink : C.inkSoft}>
            <Megaphone size={20} /> Arm Hog Call
          </BigButton>
          <button onClick={() => setHogCallOpen(false)} style={ghostBtn}>Cancel</button>
        </Sheet>
      )}

      {confirmQuit && (
        <Sheet onClose={() => setConfirmQuit(false)} title="Leave this game?">
          <p style={{ color: C.inkSoft, marginBottom: 16 }}>Scores so far will be lost. You can also just close the tab — your game is saved and will resume.</p>
          <BigButton onClick={onQuit} bg={C.brick} fg="#fff"><Trash2 size={20} /> Quit to menu</BigButton>
          <button onClick={() => setConfirmQuit(false)} style={ghostBtn}>Keep playing</button>
        </Sheet>
      )}
    </div>
  );
}

function OverScreen({ session, byId, onNext, onFinish }) {
  const g = session.games[session.games.length - 1];
  const rows = Object.keys(g.scores).map((id) => ({ id, ...byId(id), score: g.scores[id], out: (g.eliminated || []).includes(id) }))
    .sort((a, b) => b.score - a.score);
  const tie = !g.winnerId && !g.loserId;
  const loser = g.loserId ? byId(g.loserId) : null;
  const top = rows.filter((r) => !r.out && r.score === rows.filter((x) => !x.out)[0]?.score);
  const winner = (!tie && g.winnerId) ? byId(g.winnerId) : null;
  const lb = leaderboard(session.gameWins, session.playerIds, byId);

  return (
    <div className="pop">
      <Confetti />
      <div className="bouncein" style={{ textAlign: "center", marginTop: 18, marginBottom: 8, position: "relative", zIndex: 2 }}>
        {g.loserId ? (
          <>
            <div style={{ fontSize: 60, lineHeight: 1 }}>💀</div>
            <h2 style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 32, color: loser.color }}>{loser.name} loses!</h2>
            <p style={{ color: C.inkSoft, fontWeight: 700 }}>Game {g.n} · everyone else survives</p>
          </>
        ) : tie ? (
          <>
            <div style={{ fontSize: 60, lineHeight: 1 }}>🤝</div>
            <h2 style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 32 }}>It's a tie!</h2>
            <p style={{ color: C.inkSoft, fontWeight: 700 }}>{top.map((t) => `${t.avatar} ${t.name}`).join(" & ")} · {top[0]?.score} points</p>
          </>
        ) : (
          <>
            <Crown size={40} color={C.gold} style={{ marginBottom: -4 }} />
            <div style={{ fontSize: 72, lineHeight: 1 }}>{winner.avatar}</div>
            <h2 style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 34, color: winner.color }}>{winner.name} wins!</h2>
            <p style={{ color: C.inkSoft, fontWeight: 700 }}>Game {g.n} · {g.scores[g.winnerId]} points</p>
          </>
        )}
      </div>

      <Card>
        <SectionLabel>This game</SectionLabel>
        {rows.map((r, i) => (
          <div key={r.id} style={{ ...flexBetween, padding: "8px 4px", borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none", opacity: r.out ? 0.5 : 1 }}>
            <span style={{ fontWeight: 800 }}>{i + 1}. {r.out ? "💀" : r.avatar} {r.name}{r.out ? " (out)" : ""}</span>
            <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 20 }}>{r.score}</span>
          </div>
        ))}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Session · games won</SectionLabel>
        {lb.map((p, i) => (
          <div key={p.id} style={{ ...flexBetween, padding: "6px 4px" }}>
            <span style={{ fontWeight: 800 }}>{i === 0 && p.wins > 0 ? "🏆" : `${i + 1}.`} {p.avatar} {p.name}</span>
            <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 20 }}>{p.wins}</span>
          </div>
        ))}
      </Card>

      <BigButton onClick={onNext} bg={C.pink} fg="#fff" style={{ marginTop: 18 }}><Plus size={22} /> Play next game</BigButton>
      <BigButton onClick={onFinish} bg="#fff" fg={C.ink} style={{ border: `2px solid ${C.line}` }}><Trophy size={20} /> Finish session</BigButton>
    </div>
  );
}

function SummaryScreen({ session, byId, onShare, onRematch, onHome }) {
  const lb = leaderboard(session.gameWins, session.playerIds, byId);
  const champ = lb[0];

  // Build per-round score table from all games
  const allRounds = [];
  session.games.forEach((g, gi) => {
    (g.roundScores || []).forEach((rs) => {
      allRounds.push({ game: gi + 1, round: rs.round, scores: rs.scores });
    });
  });

  return (
    <div className="pop">
      <div style={{ textAlign: "center", marginTop: 22, marginBottom: 10 }}>
        <PartyPopper size={36} color={C.gold} />
        <h2 style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 30, marginTop: 4 }}>Session complete</h2>
        {champ?.wins > 0 && <p style={{ color: C.inkSoft, fontWeight: 700 }}>{champ.avatar} {champ.name} takes the crown 👑</p>}
        <p style={{ color: C.inkSoft, fontWeight: 600 }}>{session.games.length} games · {modeLabel(session.ruleset)}</p>
      </div>
      <Card>
        {lb.map((p, i) => (
          <div key={p.id} style={{ ...flexBetween, padding: "10px 4px", borderBottom: i < lb.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{i === 0 && p.wins > 0 ? "🏆" : `${i + 1}.`} {p.avatar} {p.name}</span>
            <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 22 }}>{p.wins}</span>
          </div>
        ))}
      </Card>
      {allRounds.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.8, color: C.inkSoft, marginBottom: 10 }}>
            Round scores
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.line}` }}>
                  <th style={{ padding: "4px 8px", textAlign: "left", fontWeight: 800, color: C.inkSoft }}>Rd</th>
                  {session.playerIds.map(id => (
                    <th key={id} style={{ padding: "4px 8px", textAlign: "center", fontWeight: 800, color: C.inkSoft }}>
                      {byId(id).avatar}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRounds.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <td style={{ padding: "6px 8px", fontWeight: 800, color: C.inkSoft }}>G{r.game}R{r.round}</td>
                    {session.playerIds.map(id => (
                      <td key={id} style={{ padding: "6px 8px", textAlign: "center", fontFamily: "Fredoka", fontWeight: 700 }}>
                        {r.scores[id] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <BigButton onClick={onShare} bg={C.ink} fg="#fff" style={{ marginTop: 18 }}><Share2 size={20} /> Share results</BigButton>
      <BigButton onClick={onRematch} bg={C.pink} fg="#fff"><RotateCcw size={20} /> Rematch (same players)</BigButton>
      <button onClick={onHome} style={ghostBtn}><Home size={18} /> Back to menu</button>
    </div>
  );
}

function HistoryScreen({ history, setHistory, onBack }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="pop">
      <TopBar title="History" onBack={onBack}
        right={history.length ? <button onClick={() => { if (confirm("Clear all history?")) setHistory([]); }} style={iconBtn}><Trash2 size={18} /></button> : null} />
      {history.length === 0 && (
        <div style={{ textAlign: "center", color: C.inkSoft, marginTop: 60 }}>
          <div style={{ fontSize: 48 }}>🐷</div>
          <p style={{ fontWeight: 700, marginTop: 8 }}>No sessions yet.</p>
          <p>Finish a session and it'll show up here.</p>
        </div>
      )}
      {history.map((s) => {
        const find = (id) => s.players[s.playerIds.indexOf(id)] || { name: "?", avatar: "🐷" };
        const lb = leaderboard(s.gameWins, s.playerIds, find);
        const champ = lb[0];
        return (
          <Card key={s.id} style={{ marginTop: 12 }}>
            <button onClick={() => setOpen(open === s.id ? null : s.id)} style={{ ...flexBetween, width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{champ?.wins > 0 ? `🏆 ${champ.avatar} ${champ.name}` : "Tied"}</div>
                <div style={{ color: C.inkSoft, fontWeight: 600, fontSize: 13 }}>
                  {new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {s.games.length} games · {s.players.map((p) => p.avatar).join("")}
                </div>
              </div>
              <ChevronRight size={20} color={C.inkSoft} style={{ transform: open === s.id ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
            </button>
            {open === s.id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                {lb.map((p, i) => (
                  <div key={p.id} style={{ ...flexBetween, padding: "4px 0" }}>
                    <span style={{ fontWeight: 700 }}>{i + 1}. {p.avatar} {p.name}</span>
                    <span style={{ fontWeight: 800 }}>{p.wins} {p.wins === 1 ? "win" : "wins"}</span>
                  </div>
                ))}
                <button onClick={() => shareSession(s, find)} style={{ ...ghostBtn, marginTop: 8 }}><Share2 size={16} /> Share</button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- modals ---------------- */
function RosterModal({ roster, saveRoster, onClose }) {
  const [edit, setEdit] = useState(null);
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);
  const [code, setCode] = useState("");
  const add = () => {
    const nm = name.trim(); if (!nm) return;
    const used = new Set(roster.map((p) => p.color));
    const color = SWATCHES.find((c) => !used.has(c)) || SWATCHES[roster.length % SWATCHES.length];
    saveRoster([...roster, { id: uid(), name: nm, avatar: AVATARS[roster.length % AVATARS.length], color, gamesPlayed: 0, gamesWon: 0, totalPoints: 0, highScore: 0 }]);
    setName("");
  };
  const update = (id, patch) => saveRoster(roster.map((p) => p.id === id ? { ...p, ...patch } : p));
  const remove = (id) => { if (confirm("Remove this player? Their saved name and stats go too.")) saveRoster(roster.filter((p) => p.id !== id)); };
  const [showSharePanel, setShowSharePanel] = useState(false);
  const rosterCode = useMemo(() => (roster.length ? encodeRoster(roster) : ""), [roster]);

  const copyRosterCode = async () => {
    try { await navigator.clipboard.writeText(rosterCode); alert("Player code copied!"); } catch { alert(rosterCode); }
  };

  const shareRosterCode = async () => {
    if (!rosterCode) return;
    const fullText = `🐷 My Pass The Pigs players — import this code in the app:\n\n${rosterCode}`;
    // Copy first — then offer to share
    const copied = await (async () => { try { await navigator.clipboard.writeText(fullText); return true; } catch { return false; } })();
    if (copied) {
      if (confirm("Player code copied! Share it now?")) {
        try { if (navigator.share) { await navigator.share({ title: "Pass The Pigs players", text: fullText }); return; } } catch {}
      }
    } else {
      try { if (navigator.share) { await navigator.share({ title: "Pass The Pigs players", text: fullText }); return; } } catch {}
      alert(fullText);
    }
  };
  const doImport = () => {
    try {
      const incoming = decodeRoster(code);
      const names = new Set(roster.map((p) => p.name.toLowerCase()));
      saveRoster([...roster, ...incoming.filter((p) => !names.has(p.name.toLowerCase()))]);
      setImporting(false); setCode("");
    } catch { alert("That code didn't work — check you copied all of it."); }
  };
  return (
    <Sheet onClose={onClose} title="Players">
      <p style={{ color: C.inkSoft, fontSize: 14, marginTop: -6, marginBottom: 12 }}>Saved on this device — pick them instantly next time.</p>
      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
        {roster.map((p) => (
          <div key={p.id} style={{ background: "#fff", borderRadius: 16, padding: 10, marginBottom: 8, border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, background: p.color, flex: "0 0 auto" }} />
              {edit === p.id ? (
                <input autoFocus defaultValue={p.name} onBlur={(e) => { update(p.id, { name: e.target.value.trim() || p.name }); setEdit(null); }}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()} style={{ ...textInput, padding: "6px 10px" }} />
              ) : (
                <button onClick={() => setEdit(p.id)} style={{ flex: 1, background: "none", border: "none", textAlign: "left", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{p.avatar} {p.name}</button>
              )}
              <span style={{ color: C.inkSoft, fontWeight: 700, fontSize: 13, textAlign: "right", lineHeight: 1.3 }}>{p.gamesWon || 0}🏆{(p.gamesPlayed || 0) > 0 && <><br /><span style={{ fontSize: 10, fontWeight: 600 }}>{Math.round((p.gamesWon || 0) / p.gamesPlayed * 100)}%</span></>}</span>
              <button onClick={() => remove(p.id)} style={{ ...iconBtnSm, color: C.brick }}><Trash2 size={16} /></button>
            </div>
            {edit === p.id && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {AVATARS.map((a) => <button key={a} onClick={() => update(p.id, { avatar: a })} style={{ fontSize: 20, padding: 4, borderRadius: 8, border: `2px solid ${p.avatar === a ? C.ink : "transparent"}`, background: C.cream, cursor: "pointer" }}>{a}</button>)}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {SWATCHES.map((c) => <button key={c} onClick={() => update(p.id, { color: c })} style={{ width: 26, height: 26, borderRadius: 99, background: c, border: `3px solid ${p.color === c ? C.ink : "#fff"}`, cursor: "pointer" }} />)}
                </div>
              </div>
            )}
          </div>
        ))}
        {roster.length === 0 && <p style={{ color: C.inkSoft }}>No players yet.</p>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a player…" style={textInput} />
        <button onClick={add} style={{ ...iconBtn, background: C.pink, color: "#fff", width: 52 }}><Plus size={22} /></button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => setShowSharePanel((v) => !v)} style={{ ...smallBtn, flex: 1 }}><Share2 size={16} /> Share list</button>
        <button onClick={() => setImporting((v) => !v)} style={{ ...smallBtn, flex: 1 }}><Copy size={16} /> Import code</button>
      </div>
      {showSharePanel && rosterCode && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: C.line }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: C.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Your player code
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <code style={{
              flex: 1, padding: "8px 10px", borderRadius: 8, background: C.card,
              fontSize: 11, fontFamily: "monospace", wordBreak: "break-all",
              color: C.ink, border: "1px solid " + C.line,
              userSelect: "all",
            }}>{rosterCode}</code>
            <button onClick={copyRosterCode} style={{
              flexShrink: 0, padding: "8px 12px", borderRadius: 8, border: "none",
              background: C.pink, color: "#fff", fontWeight: 700, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <Copy size={14} />
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: C.inkSoft, lineHeight: 1.4 }}>
            Anyone with this code can tap <strong>Import code</strong> to add these players to their app.
          </p>
          <button onClick={shareRosterCode} style={{
            marginTop: 8, padding: "8px 12px", borderRadius: 8, border: "none",
            background: "transparent", color: C.ink, fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Share2 size={14} /> Share via messages
          </button>
        </div>
      )}
      {importing && (
        <div style={{ marginTop: 10 }}>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a player code…" style={{ ...textInput, height: 64, resize: "none" }} />
          <BigButton disabled={!code.trim()} onClick={doImport} bg={code.trim() ? C.grass : C.line} fg={code.trim() ? "#fff" : C.inkSoft} style={{ marginTop: 8 }}>Add these players</BigButton>
        </div>
      )}
    </Sheet>
  );
}

function RulesModal({ onClose }) {
  return (
    <Sheet onClose={onClose} title="How to play">
      <p style={{ color: C.inkSoft, marginBottom: 14 }}>On your turn, toss both pigs as many times as you dare. Tap how they land to stack up points — then <b style={{ color: C.grass }}>Bank</b> before your luck runs out.</p>
      <SectionLabel>Each toss</SectionLabel>
      <RuleRow n="1" t="Sider" d="both pigs on the same side" />
      <RuleRow n="5" t="Razorback / Trotter" d="on its back / standing up" />
      <RuleRow n="10" t="Snouter" d="balanced on its snout" />
      <RuleRow n="15" t="Leaning Jowler" d="snout + ear, the show-off" />
      <RuleRow n="20–60" t="Doubles" d="both pigs strike the same pose" />
      <div style={{ height: 12 }} />
      <SectionLabel>Watch out</SectionLabel>
      <RuleRow n="0" t="Pig Out" d="pigs on opposite sides — lose this turn's points" c={C.clay} />
      <RuleRow n="0" t="Oinker" d="pigs touching — lose ALL your points" c={C.brick} />
      <RuleRow n="—" t="Piggyback" d="one pig on the other — you're out (classic rule)" c={C.plum} />
      <p style={{ color: C.inkSoft, marginTop: 14, fontSize: 14 }}>Mixed toss (two different pigs)? Tap both — the points just add up. Choose a game mode at setup, or open <b>Customize rules</b> for house rules.</p>
    </Sheet>
  );
}

/* ================================================================== *
 *  UI PRIMITIVES
 * ================================================================== */
function ScoreBtn({ o, dbl, onClick }) {
  return (
    <button onClick={onClick} className="press" style={{ background: "#fff", border: `2px solid ${dbl ? C.gold : C.line}`, borderRadius: 20,
      padding: "12px 10px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", boxShadow: `0 4px 0 ${dbl ? "#E0A52E" : C.line}`, minHeight: 64, textAlign: "left" }}>
      <span style={{ fontSize: 26, display: "inline-block", transform: `rotate(${o.tilt}deg)`, width: 30, textAlign: "center" }}>
        🐷{dbl ? <span style={{ fontSize: 14 }}>🐷</span> : null}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontWeight: 800, fontSize: 13, lineHeight: 1.1 }}>{o.name}</span>
        <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 22, color: dbl ? "#C8901F" : C.pink }}>+{o.pts}</span>
      </span>
    </button>
  );
}
function DangerBtn({ onClick, bg, title, sub }) {
  return (
    <button onClick={onClick} className="press" style={{ background: bg, color: "#fff", border: "none", borderRadius: 18, padding: "12px", cursor: "pointer", boxShadow: `0 4px 0 ${shade(bg)}` }}>
      <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 18 }}>{title}</div>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>{sub}</div>
    </button>
  );
}
function BigButton({ children, onClick, bg, fg, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} className={disabled ? "" : "press"} style={{ width: "100%", background: bg, color: fg, border: "none", borderRadius: 20, padding: "16px",
      fontFamily: "Fredoka", fontWeight: 700, fontSize: 19, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12,
      boxShadow: disabled ? "none" : `0 5px 0 ${shade(bg)}`, ...style }}>{children}</button>
  );
}
function TileButton({ onClick, icon, label, sub }) {
  return (
    <button onClick={onClick} className="press" style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 20, padding: 16, cursor: "pointer", boxShadow: `0 4px 0 ${C.line}`, textAlign: "left" }}>
      <div style={{ color: C.pink }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 16, marginTop: 6 }}>{label}</div>
      <div style={{ color: C.inkSoft, fontWeight: 600, fontSize: 13 }}>{sub}</div>
    </button>
  );
}
function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, background: C.cream, padding: 4, borderRadius: 14 }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, border: "none", cursor: "pointer",
          fontWeight: 800, fontSize: 12.5, lineHeight: 1.1, background: value === o.v ? C.ink : "transparent", color: value === o.v ? "#fff" : C.inkSoft }}>{o.l}</button>
      ))}
    </div>
  );
}
function Stepper({ value, onChange, step, min, chips }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => onChange(Math.max(min, value - step))} style={stepBtn}>–</button>
      <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 22, minWidth: 48, textAlign: "center" }}>{value}</div>
      <button onClick={() => onChange(value + step)} style={stepBtn}>+</button>
      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
        {chips.map((c) => (
          <button key={c} onClick={() => onChange(c)} style={{ padding: "6px 10px", borderRadius: 10, border: `2px solid ${value === c ? C.ink : C.line}`,
            background: value === c ? C.ink : "#fff", color: value === c ? "#fff" : C.ink, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{c}</button>
        ))}
      </div>
    </div>
  );
}
function CheckPill({ on, onClick, label }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `2px solid ${on ? C.grass : C.line}`,
      background: on ? C.grass : "#fff", color: on ? "#fff" : C.inkSoft, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
      {on && <Check size={15} />}{label}
    </button>
  );
}
function CtlRow({ label, hint, children }) { return <div style={{ marginBottom: 14 }}><div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>{label}{hint && <span title={hint} style={{ cursor: "help", fontSize: 14 }}>ℹ️</span>}</div>{children}</div>; }
function Card({ children, style }) { return <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 20, padding: 14, ...style }}>{children}</div>; }
function SectionLabel({ children, style }) { return <div style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.8, color: C.inkSoft, marginBottom: 10, ...style }}>{children}</div>; }
function TopBar({ title, onBack, right }) {
  return (
    <div style={{ ...flexBetween, marginBottom: 18 }}>
      <button onClick={onBack} style={iconBtn}><ArrowLeft size={20} /></button>
      <h2 style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 24 }}>{title}</h2>
      <div style={{ width: 44 }}>{right}</div>
    </div>
  );
}
function RuleRow({ n, t, d, c }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 16, color: c || C.pink, minWidth: 48 }}>{n}</span>
      <span><b>{t}</b> <span style={{ color: C.inkSoft }}>— {d}</span></span>
    </div>
  );
}
function Sheet({ children, title, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(46,31,51,.45)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="slideup" style={{ background: C.cream, width: "100%", maxWidth: 480, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ ...flexBetween, marginBottom: 12 }}>
          <h2 style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 24 }}>{title}</h2>
          <button onClick={onClose} style={iconBtn}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.5, dur: 1 + Math.random(),
    color: [C.pink, C.gold, C.grass, "#8C6BD9", "#4F8FD6"][i % 5], rot: Math.random() * 360 })), []);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {pieces.map((p, i) => <span key={i} className="confetti" style={{ position: "absolute", left: `${p.left}%`, top: -16, width: 10, height: 14, background: p.color, borderRadius: 2, transform: `rotate(${p.rot}deg)`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />)}
    </div>
  );
}

/* ---------- shared inline styles ---------- */
const flexBetween = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const flexCenter = { display: "flex", alignItems: "center", justifyContent: "center" };
const iconBtn = { width: 44, height: 44, borderRadius: 14, border: `2px solid ${C.line}`, background: "#fff", color: C.ink, ...flexCenter, cursor: "pointer" };
const iconBtnSm = { width: 34, height: 34, borderRadius: 11, border: `2px solid ${C.line}`, background: "#fff", color: C.ink, ...flexCenter, cursor: "pointer" };
const ghostBtn = { width: "100%", background: "none", border: "none", color: C.inkSoft, fontWeight: 700, padding: 14, marginTop: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const smallBtn = { background: "#fff", border: `2px solid ${C.line}`, borderRadius: 14, padding: "10px", fontWeight: 800, color: C.ink, cursor: "pointer", ...flexCenter, gap: 6 };
const chip = { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 16, border: "2px solid", fontWeight: 800, fontSize: 15, cursor: "pointer", position: "relative" };
const orderBadge = { position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: 99, background: C.ink, color: "#fff", fontSize: 12, ...flexCenter, fontFamily: "Fredoka" };
const presetCard = { background: "#fff", border: "2px solid", borderRadius: 18, padding: "12px 10px", cursor: "pointer", textAlign: "left" };
const textInput = { flex: 1, padding: "12px 14px", borderRadius: 14, border: `2px solid ${C.line}`, fontSize: 16, fontFamily: "Nunito", fontWeight: 600, outline: "none", background: "#fff", color: C.ink };
const stepBtn = { width: 38, height: 38, borderRadius: 12, border: `2px solid ${C.line}`, background: "#fff", color: C.ink, fontFamily: "Fredoka", fontWeight: 700, fontSize: 22, cursor: "pointer", ...flexCenter };
const tag = { background: C.gold, color: C.ink, fontWeight: 800, fontSize: 11, padding: "2px 8px", borderRadius: 8 };

function shade(hex) {
  const h = hex.replace("#", "");
  const d = (v) => Math.max(0, Math.round(parseInt(v, 16) * 0.78)).toString(16).padStart(2, "0");
  return `#${d(h.slice(0, 2))}${d(h.slice(2, 4))}${d(h.slice(4, 6))}`;
}
