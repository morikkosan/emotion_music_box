module.exports = {
  content: [
    './app/views/**/*.html.erb',
    './app/helpers/**/*.rb',
    './app/javascript/**/*.js'
  ],
  css: [
    './app/assets/builds/application.css' // もしくはプリコンパイル後のCSS
  ],
  safelist: [
    // ここは絶対消したくないクラス（動的に追加されるやつ・jsで使うものなど）例:
    'show', 'active', /^fa-/, /^btn-/
  ]
}
