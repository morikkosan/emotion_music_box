import { subscribeToPushNotifications } from "custom/push_subscription";

describe("subscribeToPushNotifications", () => {
  let originalVapid;
  beforeEach(() => {
    originalVapid = window.VAPID_PUBLIC_KEY;
    window.VAPID_PUBLIC_KEY = "TEST_KEY";
    document.head.innerHTML = `<meta name="csrf-token" content="CSRF_TOKEN">`;

    // fetchをモック
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    // PushManager モック
    const subscribeMock = jest.fn().mockResolvedValue({ endpoint: "https://example", keys: {} });
    const pushManager = { subscribe: subscribeMock };
    const registration = { pushManager };
    const readyPromise = Promise.resolve(registration);

    Object.defineProperty(global.navigator, "serviceWorker", {
      value: { ready: readyPromise },
      configurable: true,
    });

    Object.defineProperty(global.window, "PushManager", { value: function() {}, configurable: true });

    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.VAPID_PUBLIC_KEY = originalVapid;
    jest.restoreAllMocks();
  });

  test("未対応ブラウザなら何もしない", async () => {
    delete navigator.serviceWorker;
    delete window.PushManager;

    await subscribeToPushNotifications();

    expect(fetch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "PWA通知はこのブラウザでサポートされていません。"
    );
  });

  test("正常系: 購読成功しサーバー送信", async () => {
    await subscribeToPushNotifications();

    expect(fetch).toHaveBeenCalledWith("/push_subscription", expect.any(Object));
    expect(console.log).toHaveBeenCalledWith("✅ Push通知の購読に成功しました");
  });

  test("購読失敗時はconsole.errorが呼ばれる", async () => {
    navigator.serviceWorker.ready = Promise.resolve({
      pushManager: { subscribe: jest.fn().mockRejectedValue(new Error("subscribe fail")) },
    });

    await subscribeToPushNotifications();

    expect(console.error).toHaveBeenCalledWith(
      "Push通知の購読エラー:",
      expect.any(Error)
    );
  });

  test("サーバー送信失敗時はconsole.warnが呼ばれる", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    await subscribeToPushNotifications();

    expect(console.warn).toHaveBeenCalledWith("⚠️ 購読データの送信に失敗しました");
  });
});
