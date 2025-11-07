# config/initializers/assets.rb

Rails.application.config.assets.version = "1.0"

Rails.application.config.assets.paths << Rails.root.join("node_modules/bootstrap-icons/font")
Rails.application.config.assets.paths << Rails.root.join("app", "assets", "audios")

# 🔽 ここを追加 🔽
Rails.application.config.assets.paths << Rails.root.join("app", "assets", "builds")
Rails.application.config.assets.precompile += %w[builds/application.js builds/application.css]

# node_modules 以下を探しにいくようにする
Rails.application.config.assets.paths << Rails.root.join("node_modules")

# WebP をSprocketsに認識させる
Rails.application.config.assets.configure do |env|
  env.register_mime_type 'image/webp', extensions: ['.webp'], charset: :binary
end

# 画像類を確実にプリコンパイル対象へ
Rails.application.config.assets.precompile += %w[
  *.png *.jpg *.jpeg *.gif *.svg *.webp
]

# 念のため個別に明示（安全策）
Rails.application.config.assets.precompile += %w[dj_robot_icon.webp dj_robot_icon.png]
