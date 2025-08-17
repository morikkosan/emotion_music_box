import { registerServiceWorker } from "custom/register_service_worker";

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

// 直 import で catch 側を踏んで、計測漏れを埋める
test("coverage: register() が reject したときの catch を直 import で踏む", async () => {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { register: jest.fn().mockRejectedValue(new Error("boom")) }
  });
  await expect(registerServiceWorker()).rejects.toThrow("boom");
  expect(console.error).toHaveBeenCalled();
});

