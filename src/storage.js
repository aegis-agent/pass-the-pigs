import { uid } from "./engine.js";

/* Persistence adapter — localStorage. Async signatures are kept so this is a
   drop-in replacement for the window.storage adapter used in the claude.ai
   artifact build:
     async get(k){ const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
     async set(k,v){ await window.storage.set(k, JSON.stringify(v)); }
   To sync across devices, point these at your backend instead. */
export const store = {
  async get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  async set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
export const K = { ROSTER: "ptp:roster", HISTORY: "ptp:history", ACTIVE: "ptp:active" };

/* ---------- roster share codes (cross-device, no backend) ---------- */
const encodeRoster = (players) => btoa(String.fromCharCode(...new TextEncoder().encode(
  JSON.stringify(players.map((p) => ({ n: p.name, a: p.avatar, c: p.color }))))));
const decodeRoster = (code) =>
  JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.trim()), (ch) => ch.charCodeAt(0))))
    .map((p) => ({ id: uid(), name: p.n, avatar: p.a || "🐷", color: p.c || "#F2667F", gamesPlayed: 0, gamesWon: 0 }));

export { encodeRoster, decodeRoster };
