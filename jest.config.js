// jest.config.js
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/spec/javascripts"],
  setupFilesAfterEnv: ["<rootDir>/spec/javascripts/setupTests.js"],
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  moduleFileExtensions: ["js", "json"],
  moduleNameMapper: {
    // CSS / 画像 import を無害化
    "\\.(css|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png|jpe?g|webp)$": "<rootDir>/spec/javascripts/stubs/fileStub.js"
  },
  collectCoverageFrom: [
    "app/javascript/**/*.js",
    "!app/javascript/**/index.js"
  ],
  testPathIgnorePatterns: ["/node_modules/", "/tmp/"]
};
