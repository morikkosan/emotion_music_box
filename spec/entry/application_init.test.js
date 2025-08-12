// spec/javascripts/entry/application_init.test.js
/**
 * 目的：
 * - エントリポイント(app/javascript/application.js)の初期化確認
 *   - Rails UJS が start される
 *   - window.bootstrap に割り当てられる
 *   - registerServiceWorker が読み込み時に1回呼ばれる
 *   - window.isLoggedIn による DOMContentLoaded 時の購読分岐
 *   - turbo:load でも購読が呼ばれる（現状の仕様を記録）
 */

// spec/javascripts/entry/application_init.test.js
describe("application.js entrypoint init", () => {
  const pathApp = require.resolve("../../../app/javascript/application.js");
  const pathRailsUjs = "@rails/ujs";
  const pathBootstrap = "bootstrap";
  const pathControllers = require.resolve("../../../app/javascript/controllers/index.js");
  const pathComments = require.resolve("../../../app/javascript/custom/comments.js");
  const pathFlash = require.resolve("../../../app/javascript/custom/flash_messages.js");
  const pathGages = require.resolve("../../../app/javascript/custom/gages_test.js");
  const pathInline = require.resolve("../../../app/javascript/custom/inline_handlers.js");
  const pathSwal = require.resolve("../../../app/javascript/custom/swal_my_create.js");
  const pathRegister = require.resolve("../../../app/javascript/custom/register_service_worker.js");
  const pathSubscribe = require.resolve("../../../app/javascript/custom/push_subscription.js");
  const pathTurboRails = "@hotwired/turbo-rails";

  let RailsMock;
  let registerMock;
  let subscribeMock;

  beforeEach(() => {
    jest.resetModules();

    jest.mock(pathRailsUjs, () => ({
      __esModule: true,
      default: { start: jest.fn() },
    }));

    jest.mock(pathTurboRails, () => ({}), { virtual: true });
    jest.mock(pathBootstrap, () => ({ Modal: function() {} }));

    jest.mock(pathControllers, () => ({}), { virtual: true });
    jest.mock(pathComments, () => ({}), { virtual: true });
    jest.mock(pathFlash, () => ({}), { virtual: true });
    jest.mock(pathGages, () => ({}), { virtual: true });
    jest.mock(pathInline, () => ({}), { virtual: true });
    jest.mock(pathSwal, () => ({}), { virtual: true });

    jest.mock(pathRegister, () => ({
      __esModule: true,
      registerServiceWorker: jest.fn().mockResolvedValue({ scope: "/sw" }),
    }));
    jest.mock(pathSubscribe, () => ({
      __esModule: true,
      subscribeToPushNotifications: jest.fn().mockResolvedValue(undefined),
    }));

    RailsMock = require(pathRailsUjs).default;
    registerMock = require(pathRegister).registerServiceWorker;
    subscribeMock = require(pathSubscribe).subscribeToPushNotifications;

    document.body.innerHTML = "";
    window.bootstrap = undefined;
    delete window.isLoggedIn;
  });

  test("UJS start / window.bootstrap セット / registerServiceWorker が一度呼ばれる", async () => {
    require(pathApp);

    expect(RailsMock.start).toHaveBeenCalledTimes(1);
    expect(window.bootstrap).toBeDefined();
    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  test("window.isLoggedIn=false: DOMContentLoaded / turbo:load でも購読されない", async () => {
    require(pathApp);

    window.isLoggedIn = false;
    document.dispatchEvent(new Event("DOMContentLoaded"));
    document.dispatchEvent(new Event("turbo:load"));
    expect(subscribeMock).toHaveBeenCalledTimes(0);
  });

  test("window.isLoggedIn=true: DOMContentLoaded と turbo:load の両方が来ても 1回だけ購読", async () => {
    require(pathApp);

    window.isLoggedIn = true;
    document.dispatchEvent(new Event("DOMContentLoaded"));
    document.dispatchEvent(new Event("turbo:load"));
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });
});
