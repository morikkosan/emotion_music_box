  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(reg) {
        console.log('[PWA] ServiceWorker 登録成功:', reg);
      }).catch(function(error) {
        console.error('[PWA] ServiceWorker 登録失敗:', error);
      });
  }
 
 
 
 
 const VAPID_PUBLIC_KEY = "<%= ENV['VAPID_PUBLIC_KEY'] %>";

  async function subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn("PWA通知はこのブラウザでサポートされていません。");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

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

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

