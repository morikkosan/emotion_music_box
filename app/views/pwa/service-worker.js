self.addEventListener("push", async (event) => {
  console.log("[Service Worker] push event received");

  // ここに好きなログやalert（※）を入れる
  // alert("通知がきました！");  // Service Worker ではalertは動きません
  // 代わりに
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

    const { title, options } = data;
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error("[Service Worker] Push event error:", error);
  }
});
