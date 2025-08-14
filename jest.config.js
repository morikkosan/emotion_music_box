// jest.config.js
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/spec/javascripts"],
  setupFiles: [
    "<rootDir>/test/setup/polyfills.js"
  ],
  setupFilesAfterEnv: [
    "<rootDir>/spec/javascripts/setupTests.js",
    "<rootDir>/test/setup/jest.setup.js"
  ],
  transform: {
    "^.+\\.(js|mjs)$": "babel-jest"
  },
  moduleFileExtensions: ["js", "json", "mjs"],
  moduleNameMapper: {
    "\\.(css|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png|jpe?g|webp)$": "<rootDir>/spec/javascripts/stubs/fileStub.js",
    "^@hotwired/turbo-rails$": "<rootDir>/spec/javascripts/stubs/turboRailsStub.js",
    "^@rails/ujs$": "<rootDir>/spec/javascripts/stubs/railsUjsStub.js",
    "^bootstrap$": "<rootDir>/spec/javascripts/stubs/bootstrapStub.js",
    "^@hotwired/stimulus$": "<rootDir>/spec/javascripts/stubs/stimulusStub.js",

    // ▼ 追加: app/javascript/controllers や custom ディレクトリをエイリアス解決
    '^controllers/(.*)$': '<rootDir>/app/javascript/controllers/$1',
    '^custom/(.*)$': '<rootDir>/app/javascript/custom/$1'
  },
  collectCoverageFrom: [
    "app/javascript/**/*.js",
    "!app/javascript/**/index.js",

    // ★ エントリ専用（副作用のみ）のためカバレッジ対象から除外
    "!app/javascript/**/push_notifications.js",
    "!app/javascript/**/push_notifications.mjs"
  ],
  testPathIgnorePatterns: ["/node_modules/", "/tmp/"],
  moduleDirectories: [
    "node_modules",
    "<rootDir>/app/javascript"
  ],
  testMatch: ["**/spec/javascripts/**/*.test.[jt]s?(x)"],

  // ★ ここに追加（計測をV8に切替。挙動は不変、行ズレが起きにくい）
  coverageProvider: "v8"
};
