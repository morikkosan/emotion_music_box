// app/javascript/controllers/push_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  async connect() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    // Service Worker 登録
    const registration = await navigator.serviceWorker.register("/service-worker.js")

    // 通知許可をリクエスト
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return

    // VAPID公開鍵を取得・変換
    const vapidPublicKey = document.querySelector('meta[name="vapid-public-key"]').content
    const convertedKey = this._urlBase64ToUint8Array(vapidPublicKey)

    // 既存のPush購読を取得し、あれば解除
    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      await existingSubscription.unsubscribe()
    }

    // 新しいPush購読を作成
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey
    })

    // CSRFトークン取得
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content

    // サーバーに購読情報を送信
    await fetch("/push_subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({ subscription })
    })
  }

  // Base64文字列をUint8Arrayに変換する関数
  _urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
  }
}
