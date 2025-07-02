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

    // ここを修正↓↓
    let title, options;
    if ("options" in data) {
      // { title, options } 形式の場合（今まで通り）
      ({ title, options } = data);
    } else {
      // { title, body }形式の時（Railsから送信された形）
      title = data.title || "通知";
      options = { body: data.body };
    }

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error("[Service Worker] Push event error:", error);
  }
});
