// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        // jsdom/Jest で動くターゲット
        targets: { node: "current" },
        // 必要な変換だけ
        modules: "auto"
      }
    ]
  ]
};
