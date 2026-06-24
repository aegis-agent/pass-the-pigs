import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA offline support
// --- Service Worker with update detection ---
if ("serviceWorker" in navigator) {
  let updateCallback = null;

  // Expose an update-check function globally so App can call it
  window.__ptpCheckForUpdates = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { updateAvailable: false, reason: "no-sw" };
    try {
      await reg.update();
      // The updatefound event below fires if there's a new SW
      return { updateAvailable: false, checked: true };
    } catch (err) {
      return { updateAvailable: false, reason: err.message };
    }
  };

  // Expose a callback setter so App can subscribe to update events
  window.__ptpOnUpdate = (cb) => { updateCallback = cb; };

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("SW registered:", reg.scope);

        // If there's already a waiting SW, fire immediately
        if (reg.waiting) {
          updateCallback?.({ type: "waiting", reg });
        }

        // Listen for new SW installing
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New content available — prompt user
              updateCallback?.({ type: "installed", reg, newWorker });
            }
          });
        });
      })
      .catch((err) => console.log("SW registration failed:", err));

    // Detect when a waiting SW becomes active (user refreshed after update)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      updateCallback?.({ type: "activated" });
    });
  });
}
