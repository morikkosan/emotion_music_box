require_relative "boot"

# ✅ 追加: .env を早期に読み込む
require "dotenv/load"

require "rails/all"

Bundler.require(*Rails.groups)

module Myapp
  class Application < Rails::Application
    config.load_defaults 7.2

    config.action_view.form_with_generates_remote_forms = false
    config.api_only = false  # APIモード無効

    config.assets.paths << Rails.root.join("app", "assets", "builds")

    config.i18n.load_path += Dir[Rails.root.join("config", "locales", "**", "*.{rb,yml}")]
    config.i18n.default_locale = :ja

    config.eager_load_paths << Rails.root.join("lib")

    # ここをシンプルに統一 ✅
    config.autoload_paths += %W[
      #{config.root}/lib
      #{config.root}/app/strategies
    ]
    config.eager_load_paths += %W[
      #{config.root}/app/strategies
    ]

    config.time_zone = "Tokyo"
    config.active_record.default_timezone = :local

    config.action_dispatch.session_store :cookie_store,
      key: "_myapp_session",
      secure: true,
      same_site: :lax,
      domain: ".moriappli-emotion.com",
      path: "/"

    # ✅ 環境変数が存在しなければ credentials から補完
    ENV["SOUNDCLOUD_CLIENT_ID"] ||= Rails.application.credentials.dig(:soundcloud, :client_id)

    config.middleware.insert_after ActionDispatch::Static, Rack::Deflater
  end
end
