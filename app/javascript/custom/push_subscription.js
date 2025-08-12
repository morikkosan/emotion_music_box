
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn("PWA通知はこのブラウザでサポートされていません。");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),  // ここを window.付きに
    });

    // サーバーにsubscriptionを送信（ログインユーザーと紐付け）
    const res = await fetch('/push_subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
      },
      body: JSON.stringify({ subscription }),
    });

    if (res.ok) {
      console.log("✅ Push通知の購読に成功しました");
    } else {
      console.warn("⚠️ 購読データの送信に失敗しました");
    }
  } catch (err) {
    console.error("Push通知の購読エラー:", err);
  }
}

// 文字列 → Uint8Array 変換
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
