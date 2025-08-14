import { registerServiceWorker } from "custom/register_service_worker";

describe("registerServiceWorker", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  test("未対応環境ではnullを返す", async () => {
    delete navigator.serviceWorker;
    const res = await registerServiceWorker();
    expect(res).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("ServiceWorker 未対応");
  });

  test("登録成功時はregistrationを返す", async () => {
    const mockReg = { scope: "/test" };
    navigator.serviceWorker = { register: jest.fn().mockResolvedValue(mockReg) };
    const res = await registerServiceWorker();
    expect(res).toBe(mockReg);
    expect(console.log).toHaveBeenCalledWith("[PWA] ServiceWorker 登録成功:", mockReg);
  });

  test("登録失敗時は例外を投げる", async () => {
    navigator.serviceWorker = { register: jest.fn().mockRejectedValue(new Error("fail")) };
    await expect(registerServiceWorker()).rejects.toThrow("fail");
    expect(console.error).toHaveBeenCalledWith("[PWA] ServiceWorker 登録失敗:", expect.any(Error));
  });
});
