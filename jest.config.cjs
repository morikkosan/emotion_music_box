module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/spec/javascripts"],

  // jsdom 起動前に読む（必要なら既存 polyfills をそのまま維持）
  setupFiles: ["<rootDir>/test/setup/polyfills.js"],

  // 各テストの前後で動く共通セットアップ
  setupFilesAfterEnv: [
    "<rootDir>/spec/javascripts/setupTests.js",
    "<rootDir>/test/setup/jest.setup.js",
  ],

  transform: { "^.+\\.(js|mjs)$": "babel-jest" },
  moduleFileExtensions: ["js", "json", "mjs"],

  moduleNameMapper: {
    "\\.(css|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png|jpe?g|webp)$": "<rootDir>/spec/javascripts/stubs/fileStub.js",
    "^@hotwired/turbo-rails$": "<rootDir>/spec/javascripts/stubs/turboRailsStub.js",
    "^@rails/ujs$": "<rootDir>/spec/javascripts/stubs/railsUjsStub.js",
    "^bootstrap$": "<rootDir>/spec/javascripts/stubs/bootstrapStub.js",
    "^@hotwired/stimulus$": "<rootDir>/spec/javascripts/stubs/stimulusStub.js",

    // エイリアス
    "^controllers/(.*)$": "<rootDir>/app/javascript/controllers/$1",
    "^custom/(.*)$": "<rootDir>/app/javascript/custom/$1",
  },

  collectCoverageFrom: [
    "app/javascript/**/*.js",
    "!app/javascript/**/index.js",
    // エントリ専用(副作用のみ)は除外
    "!app/javascript/**/push_notifications.js",
    "!app/javascript/**/push_notifications.mjs",
  ],

  testPathIgnorePatterns: ["/node_modules/", "/tmp/"],
  moduleDirectories: ["node_modules", "<rootDir>/app/javascript"],
  testMatch: ["**/spec/javascripts/**/*.test.[jt]s?(x)"],

  // 行ズレが起きにくい v8 カバレッジ
  coverageProvider: "v8",

  // (任意) テストごとにモック初期化したい場合
  // resetMocks: true,
  // restoreMocks: true,
  // clearMocks: true,
};
