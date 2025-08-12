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
    "^@hotwired/stimulus$": "<rootDir>/spec/javascripts/stubs/stimulusStub.js"
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
  testMatch: ["**/spec/javascripts/**/*.test.[jt]s?(x)"]
};
