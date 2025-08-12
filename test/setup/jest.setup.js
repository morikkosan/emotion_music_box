// 各テスト実行前の共通セットアップ

// console の不要な出力を抑える（必要に応じてコメントアウト）
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// SweetAlert2 の最低限モック
if (!global.window) global.window = {};
if (!window.Swal) {
  window.Swal = {
    fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
  };
}
