# config/initializers/assets.rb

Rails.application.config.assets.version = "1.0"

Rails.application.config.assets.paths << Rails.root.join("node_modules/bootstrap-icons/font")
Rails.application.config.assets.paths << Rails.root.join('app', 'assets', 'audios')

# 🔽 ここを追加 🔽
Rails.application.config.assets.paths << Rails.root.join("app", "assets", "builds")
Rails.application.config.assets.precompile += %w(builds/application.js builds/application.css)
