/* service-worker.js */

/* —————————————————————————————————————
 *  即時反映の基本ハンドリング（任意だけど便利）
 * ————————————————————————————————————— */
self.addEventListener("install", (event) => {
  // 新しいSWを即アクティブ化
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 既存クライアントへ即適用
  event.waitUntil(self.clients.claim());
});

/* —————————————————————————————————————
 *  重要：音声/HLS/SoundCloud系は SW を素通し
 *  （respondWith しない＝ブラウザに任せる）
 *  iOS Safari は Range/HLS の取り扱いが厳密なので、
 *  ここをキャッシュ/プロキシすると再生が失敗します。
 * ————————————————————————————————————— */
self.addEventListener("fetch", (event) => {
  try {
    const req = event.request;
    const url = new URL(req.url);

    // destination: 'audio' / 'video' は無条件で素通し
    const isMediaDest =
      req.destination === "audio" || req.destination === "video";

    // SoundCloud 配信系のホストは一切触らない
    const isSoundCloudHost =
      /(^|\.)soundcloud\.com$/i.test(url.hostname) ||
      /(^|\.)w\.soundcloud\.com$/i.test(url.hostname) ||
      /(^|\.)sndcdn\.com$/i.test(url.hostname) ||
      /(^|\.)hls-media\.sndcdn\.com$/i.test(url.hostname) ||
      /(^|\.)cf-hls-media\.sndcdn\.com$/i.test(url.hostname);

    // m3u8/ts/aac などHLS拡張子っぽいものも素通し（保険）
    const isHlsExt = /\.(m3u8|m3u|ts|aac)(\?|$)/i.test(url.pathname);

    if (isMediaDest || isSoundCloudHost || isHlsExt) {
      // 何もしない＝ブラウザへ委譲
      return;
    }
  } catch (e) {
    // 解析失敗時は何もしない（ブラウザへ委譲）
    return;
  }

  // ↑以外はここでキャッシュ戦略を入れたい場合に respondWith を書く
  // いまは素通し（アプリ側で必要になったら追加）
  // 例：
  // event.respondWith(fetch(event.request));
});

/* —————————————————————————————————————
 *  Push 通知（あなたの既存コードをそのまま採用）
 * ————————————————————————————————————— */
self.addEventListener("push", async (event) => {
  console.log("[Service Worker] push event received");

  clients.matchAll({ type: "window" }).then((clientsArr) => {
    clientsArr.forEach((windowClient) => {
      windowClient.postMessage("Push通知が届いたよ！");
    });
  });

  try {
    let data;
    try {
      data = event.data ? event.data.json() : {};
    } catch (jsonError) {
      data = {
        title: await event.data.text(),
        options: {},
      };
    }

    console.log("[Service Worker] Push data:", data);

    let title, options;
    if ("options" in data) {
      ({ title, options } = data);
    } else {
      title = data.title || "通知";
      options = { body: data.body };
    }

    // アイコン等のデフォルト付与
    options = {
      ...options,
      icon: "/icon-192.png", // 実ファイルに合わせて
      badge: "/badge.png",   // 無ければ削除OK
      tag: "push",
      renotify: true,
    };

    console.log("[Service Worker] showNotification args", title, options);

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("[Service Worker] Push event error:", error);
  }
});

/* —————————————————————————————————————
 *  通知クリック（任意：通知からアプリに復帰）
 * ————————————————————————————————————— */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      // 既存タブがあればフォーカス、なければ新規
      const targetUrl = "/";
      for (const client of allClients) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })()
  );
});
