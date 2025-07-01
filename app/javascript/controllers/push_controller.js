import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  async connect() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js")
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return

      const vapidPublicKey = document.querySelector('meta[name="vapid-public-key"]').content
      const convertedKey = this._urlBase64ToUint8Array(vapidPublicKey)

      const existingSubscription = await registration.pushManager.getSubscription()
      if (existingSubscription) {
        try {
          await existingSubscription.unsubscribe()
        } catch (error) {
          console.warn("Push subscription unsubscribe failed:", error)
        }
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      })

      const csrfToken = document.querySelector('meta[name="csrf-token"]').content

      await fetch("/push_subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ subscription })
      })
    } catch (error) {
      console.error("Push subscription failed:", error)
    }
  }

  _urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
  }
}
