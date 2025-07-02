self.addEventListener("push", async (event) => {
  console.log("[Service Worker] push event received");

  clients.matchAll({type: "window"}).then(clientsArr => {
    clientsArr.forEach(windowClient => {
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
        options: {}
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

    // **ここでoptionsにicon/badge等を強制的に追加**
    options = {
      ...options,
      icon: "/icon-192.png", // パスはあなたのアプリのアイコンファイルに合わせて！
      badge: "/badge.png",   // これも（無ければiconだけでもOK）
      tag: "push",           // 任意のタグ
      renotify: true         // 同じtagでも通知する
    };

    console.log("[Service Worker] showNotification args", title, options);

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error("[Service Worker] Push event error:", error);
  }
});
