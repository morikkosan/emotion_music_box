import { subscribeToPushNotifications } from "custom/push_subscription";

describe("subscribeToPushNotifications: 既存購読がある場合のフロー", () => {
  let origVapid;

  beforeEach(() => {
    origVapid = window.VAPID_PUBLIC_KEY;
    window.VAPID_PUBLIC_KEY = "BEl8n8JYwJx-5y0Q9bKx2rF0V1lQwq-0Zy0Hq7z2V2c"; // ダミー

    document.head.innerHTML = `<meta name="csrf-token" content="CSRF_TOKEN">`;
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const unsubscribeMock = jest.fn().mockResolvedValue(true);
    const existingSubscription = { unsubscribe: unsubscribeMock };

    const subscribeMock = jest.fn().mockResolvedValue({ endpoint: "https://new-sub", keys: {} });
    const pushManager = {
      getSubscription: jest.fn().mockResolvedValue(existingSubscription),
      subscribe: subscribeMock,
    };
    const registration = { pushManager };
    const readyPromise = Promise.resolve(registration);

    Object.defineProperty(global, "navigator", {
      value: { serviceWorker: { ready: readyPromise } },
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: { ...global.window, PushManager: function() {} },
      configurable: true,
    });

    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.VAPID_PUBLIC_KEY = origVapid;
    jest.restoreAllMocks();
  });

  test("既存購読があるときに unsubscribe → subscribe → fetch が呼ばれる", async () => {
    await subscribeToPushNotifications();

    expect(fetch).toHaveBeenCalledWith("/push_subscription", expect.any(Object));
    expect(console.log).toHaveBeenCalledWith("✅ Push通知の購読に成功しました");
  });
});
