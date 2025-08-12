// jest.config.js
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/spec/javascripts"],
  setupFiles: [
    "<rootDir>/test/setup/polyfills.js" // fetchやTextEncoderなどのポリフィル
  ],
  setupFilesAfterEnv: [
    "<rootDir>/spec/javascripts/setupTests.js",
    "<rootDir>/test/setup/jest.setup.js" // SweetAlertモックやconsole抑制
  ],
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  moduleFileExtensions: ["js", "json"],
  moduleNameMapper: {
    "\\.(css|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png|jpe?g|webp)$": "<rootDir>/spec/javascripts/stubs/fileStub.js"
  },
  collectCoverageFrom: [
    "app/javascript/**/*.js",
    "!app/javascript/**/index.js"
  ],
  testPathIgnorePatterns: ["/node_modules/", "/tmp/"],
  moduleDirectories: [
    "node_modules",
    "<rootDir>/app/javascript"
  ],
  // spec/javascripts配下を拾うように修正
  testMatch: ["**/spec/javascripts/**/*.test.[jt]s?(x)"]
};
