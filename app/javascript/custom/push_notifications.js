// サービスワーカー登録（共通関数）テストのエントリは低カバレッジでも正常、という運用。そのファイルは “ブートストラップ専用”（registerServiceWorker() を呼ぶだけ）で、ロジックは外に export されていない。実質的な品質担保は、購読ロジックを検証している push_subscription.*.test.js 側で済んでいる。元コードを変更しない前提だと、エントリでは行を実行しにくく、カバレッジのノイズになりがち。だからカバレッジ対象から外す運用が定石。
import { registerServiceWorker } from "./register_service_worker";
registerServiceWorker();


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

