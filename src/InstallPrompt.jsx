import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "ptp_install_prompt";
const COOLDOWN_DAYS = 30;
const IOS_IDLE_SECONDS = 45;

function getStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.never) return "never";
    if (data.dismissedAt) {
      const age = Date.now() - data.dismissedAt;
      if (age < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return "cooldown";
    }
    return null;
  } catch {
    return null;
  }
}

function setStored(never = false) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dismissedAt: Date.now(), never })
    );
  } catch {}

// Export all PTP game state for cross-sandbox migration (iOS PWA)
function exportGameState() {
  const state = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('ptp:')) {
      state[key] = localStorage.getItem(key);
    }
  }
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pass-the-pigs-save.json';
  a.click();
  URL.revokeObjectURL(url);
}
}

export default function InstallPrompt({ gameJustFinished }) {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState(null);
  const deferredRef = useRef(null);
  const timerRef = useRef(null);
  const shownRef = useRef(false);

  // Detect platform + listen for beforeinstallprompt
  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.MSStream;
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) return;
    if (getStored() !== null) return;

    // Chrome / Chromium: show as soon as beforeinstallprompt fires
    // (the browser has already determined the user is engaged enough)
    const handler = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      if (!shownRef.current) {
        setMode("chrome");
        const t = setTimeout(() => setShow(true), 800);
        timerRef.current = t;
        shownRef.current = true;
      }
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: start idle timer on mount
    if (isIOS) {
      setMode("ios");
      timerRef.current = setTimeout(() => {
        if (!shownRef.current) {
          setShow(true);
          shownRef.current = true;
        }
      }, IOS_IDLE_SECONDS * 1000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Also show on iOS immediately after first game finishes
  useEffect(() => {
    if (gameJustFinished && mode === "ios" && !shownRef.current) {
      const t = setTimeout(() => {
        setShow(true);
        shownRef.current = true;
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [gameJustFinished, mode]);

  const handleInstall = useCallback(async () => {
    if (mode === "chrome" && deferredRef.current) {
      deferredRef.current.prompt();
      const { outcome } = await deferredRef.current.userChoice;
      deferredRef.current = null;
      if (outcome === "accepted") {
        setShow(false);
        return;
      }
    }
    setShow(false);
    setStored(false);
  }, [mode]);

  const handleDismiss = () => {
    setShow(false);
    setStored(false);
  };

  const handleNever = () => {
    setShow(false);
    setStored(true);
  };

  if (!show) return null;

  const isChrome = mode === "chrome";
  const isIOS = mode === "ios";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(46, 31, 51, 0.6)",
          zIndex: 1000,
          animation: "ptpFadeIn .25s ease",
        }}
      />
      {/* Card */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: 16,
          right: 16,
          maxWidth: 440,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 24,
          padding: "22px 20px 18px",
          zIndex: 1001,
          boxShadow: "0 12px 40px rgba(46,31,51,0.25)",
          animation: "ptpSlideUp .35s ease",
          fontFamily: "Nunito, system-ui, sans-serif",
        }}
      >
        <button
          onClick={handleDismiss}
          aria-label="Close"
          style={{
            position: "absolute", top: 12, right: 14,
            background: "none", border: "none", fontSize: 22,
            cursor: "pointer", color: "#7A6B7E",
            lineHeight: 1, padding: 4,
          }}
        >
          \u00d7
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            flexShrink: 0, width: 56, height: 56, borderRadius: 16,
            background: "#F2667F", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 32, boxShadow: "0 4px 0 #D94E6B",
          }}>
            {"\uD83D\uDC37"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#2E1F33", marginBottom: 4 }}>
              {isChrome ? "Install Pass The Pigs" : "Add to Home Screen"}
            </div>
            <p style={{ margin: 0, color: "#7A6B7E", fontWeight: 600, fontSize: 14, lineHeight: 1.5 }}>
              {isChrome
                ? "Get quick access and play offline \u2014 no downloads, just tap install."
                : "Install this app on your iPhone: tap the Share button then \u201cAdd to Home Screen\u201d."}
            </p>
          </div>
        </div>

        {isIOS && (
          <>
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center" }}>
              {[
                ["📤", "Tap Share"],
                ["📲", "Add to Home"],
                ["✅", "Tap Add"],
              ].map(([icon, label], i) => (
                <div key={i} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A6B7E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 12,
              background: "#FFF3E0", border: "1px solid #FFCC80",
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#E65100", marginBottom: 4 }}>
                {"⚠️ iOS note: game progress won\u2019t carry over"}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#BF360C", lineHeight: 1.4 }}>
                Apple gives each installed app its own storage. Export your game state below, then import it after installing.
              </p>
              <button onClick={(e) => { e.stopPropagation(); exportGameState(); }} style={{
                marginTop: 8, padding: "8px 14px", borderRadius: 10, border: "none",
                background: "#FF9800", color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: "pointer", fontFamily: "inherit", width: "100%",
              }}>
                {"💾 Export Game State"}
              </button>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {(isChrome || isIOS) && (
            <button onClick={handleInstall} style={{
              flex: 1, padding: "12px 16px", borderRadius: 16, border: "none",
              background: "#F2667F", color: "#fff", fontWeight: 800, fontSize: 15,
              cursor: "pointer", boxShadow: "0 4px 0 #D94E6B", fontFamily: "inherit",
            }}>
              {isChrome ? "Install" : "Got it!"}
            </button>
          )}
          <button onClick={handleNever} style={{
            padding: "12px 16px", borderRadius: 16, border: "none",
            background: "transparent", color: "#7A6B7E", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            Don\u2019t ask again
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ptpFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ptpSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
