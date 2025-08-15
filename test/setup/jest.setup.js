// test/setup/jest.setup.js
import 'whatwg-fetch';

// ---- jest-dom の matcher を“安全に” extend（default 等の非関数を除外）----
import * as rawMatchers from '@testing-library/jest-dom/matchers';
const matchers = Object.fromEntries(
  Object.entries(rawMatchers).filter(([, v]) => typeof v === 'function')
);
expect.extend(matchers);

// ---- PointerEvent の安全ポリフィル（既にあれば何もしない）----
if (!global.PointerEvent) {
  class PEvent extends MouseEvent {
    constructor(type, opts = {}) {
      // button/buttons は MouseEvent の init で渡す（後から代入しない）
      super(type, opts);
      Object.defineProperty(this, 'pointerId',  { value: opts.pointerId ?? 1, enumerable: true });
      Object.defineProperty(this, 'isPrimary',  { value: opts.isPrimary ?? true, enumerable: true });
      if (opts.pointerType) {
        Object.defineProperty(this, 'pointerType', { value: opts.pointerType, enumerable: true });
      }
    }
  }
  global.PointerEvent = PEvent;
}

// jsdom に無い API をダミーで生やす（存在すれば何もしない）
if (!Element.prototype.setPointerCapture) {
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    value: function () {},
    configurable: true,
    writable: true,
  });
}
if (!Element.prototype.releasePointerCapture) {
  Object.defineProperty(Element.prototype, 'releasePointerCapture', {
    value: function () {},
    configurable: true,
    writable: true,
  });
}

// ---- テスト全体で noisy なログを抑制（非同期ログも拾えるよう beforeAll/afterAll）----
let origWarn, origError;

beforeAll(() => {
  origWarn  = console.warn.bind(console);
  origError = console.error.bind(console);

  // ここで丸ごと封じる：テストが“意図的に”error を期待していない限り安全
  // （もし特定テストで console.error を検証したい場合は、そのテスト内で
  //  いったん jest.spyOn(console, 'error') し直せばOK）
  // console.log はそのまま残す
  // eslint-disable-next-line no-console
  console.warn  = jest.fn(() => {});
  // eslint-disable-next-line no-console
  console.error = jest.fn(() => {});
});

afterAll(() => {
  // 元に戻す（watch モードでも積み上がらないように）
  if (origWarn)  console.warn  = origWarn;
  if (origError) console.error = origError;
});

// ※ DOM の消去や MutationObserver の差し替え等はここではしない。
//   （それらは spec/javascripts/setupTests.js に任せる）
