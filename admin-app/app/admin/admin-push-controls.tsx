"use client";

import { useEffect, useState } from "react";

const worker = "/admin-push-worker.js";

export default function AdminPushControls() {
  const [key, setKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    async function load() {
      const response = await fetch("/api/admin/push", { cache: "no-store" });
      if (!response.ok) return;
      const { publicKey } = await response.json();
      if (!publicKey) return;

      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && Notification.permission === "granted") {
        const response = await fetch("/api/admin/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", endpoint: subscription.endpoint }),
        });
        setEnabled(response.ok);
      }
      setKey(publicKey);
    }

    void load().catch(() => setMessage("Could not check background alerts."));
  }, []);

  async function update(action: "enable" | "disable" | "test") {
    setBusy(true);
    setMessage("");
    try {
      if (action === "enable" && await Notification.requestPermission() !== "granted") {
        setMessage("Allow notifications for this site in Chrome to enable order alerts.");
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration("/admin/");
      if (!registration && action === "enable") {
        registration = await navigator.serviceWorker.register(worker, { scope: "/admin/" });
        const installing = registration.installing ?? registration.waiting;
        if (installing && installing.state !== "activated") {
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => finish(new Error("Notification setup timed out.")), 8000);
            function finish(error?: Error) {
              window.clearTimeout(timeout);
              installing?.removeEventListener("statechange", check);
              if (error) reject(error);
              else resolve();
            }
            function check() {
              if (installing?.state === "activated") finish();
              if (installing?.state === "redundant") finish(new Error("Notification setup failed."));
            }
            installing.addEventListener("statechange", check);
            check();
          });
        }
      }
      if (!registration) throw new Error("Open the dashboard again to set up notifications.");

      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? (action === "enable" ? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }) : null);
      if (!subscription) throw new Error("Enable notifications on this device first.");

      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription.toJSON(), action }),
      });
      if (!response.ok) throw new Error("Petrocrib could not complete the notification request.");

      if (action === "disable") {
        setEnabled(false);
        await subscription.unsubscribe();
      } else if (action === "enable") {
        setEnabled(true);
      } else {
        setMessage("Test sent. Check your Android notifications.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update background alerts.");
    } finally {
      setBusy(false);
    }
  }

  if (!key && !message) return null;

  return <div>
    {key && <button className="btn" type="button" disabled={busy}
      onClick={() => void update(enabled ? "disable" : "enable")}>
      {enabled ? "Disable background alerts" : "Enable notifications"}
    </button>}
    {enabled && <button className="btn" type="button" disabled={busy} onClick={() => void update("test")}>
      Send test notification
    </button>}
    {message && <p className="small" role="status">{message}</p>}
  </div>;
}
