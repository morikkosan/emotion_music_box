// spec/javascripts/setupTests.js
import "@testing-library/jest-dom";
import "whatwg-fetch";

if (!window.alert) {
  window.alert = () => {};
}

if (!window.Swal) {
  window.Swal = {
    fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
    close: jest.fn()
  };
}

afterEach(() => {
  try { localStorage.clear(); } catch (_) {}
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

// ---- jsdom で未実装のAPIをモック ----
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => cb();
}

if (!global.ResizeObserver) {
  class MockResizeObserver {
    constructor(callback) { this._cb = callback; }
    observe() { /* レイアウトは無いので何もしない */ }
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = MockResizeObserver;
}

// jsdomはレイアウトがないため offsetWidth が常に 0 → 強制的に正の値に
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() { return 100; }
});

// jsdom の innerText を textContent で代用（読み書きの両方）
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerText")) {
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    get() { return this.textContent; },
    set(v) { this.textContent = v; }
  });
}
