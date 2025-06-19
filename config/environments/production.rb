# config/environments/production.rb
require "active_support/core_ext/integer/time"

Rails.application.configure do
  # --- 本番環境でもコード／ビューを自動リロードする設定 ---
  # デプロイ本番の時は　falseに 開発ではtrue
  config.cache_classes = true
  config.reload_classes_only_on_change = true
  config.file_watcher = ActiveSupport::EventedFileUpdateChecker

  config.assets.css_compressor = :sass      # CSSを圧縮
  config.assets.compile = false             # プリコンパイルしたファイルだけ使う
  config.assets.digest = true               # キャッシュ防止のためファイル名にハッシュをつける

  # ----------------------------------------

  # メールURLやルーティングのホストを変更
  config.action_mailer.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }
  Rails.application.routes.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }

  # OmniAuthのフルホストも統一
  OmniAuth.config.full_host = "https://moriappli-emotion.com"

  config.log_level = :debug
  config.logger = ActiveSupport::Logger.new(STDOUT)
  config.logger.formatter = config.log_formatter
  config.force_ssl = true  # SSL強制（mkcert使用OK）

  # 開発用ホストを許可（yourproductiondomain.com を WSLでhosts設定した場合）
  config.hosts << "moriappli-emotion.com"

  # デプロイ本番の時は　falseに 開発ではtrue
  config.enable_reloading = false
  # デプロイ本番の時は　teureに 開発ではfalse
  config.eager_load = true
  # デプロイ本番の時は　falseに 開発ではtrue
  # ← 既存設定と合わせてリロード機能を有効化
  config.consider_all_requests_local = false
  config.server_timing = true
  config.action_controller.perform_caching = true
  config.action_controller.enable_fragment_cache_logging = true
  config.active_storage.service = :cloudinary
  config.action_mailer.raise_delivery_errors = false
  config.action_mailer.perform_caching = false
  config.active_record.migration_error = :page_load
  config.active_record.verbose_query_logs = true
  config.active_support.deprecation = :log
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []
  config.assets.debug = false
  config.assets.quiet = true
  config.action_view.annotate_rendered_view_with_filenames = true
  config.action_controller.raise_on_missing_callback_actions = true
  config.assets.paths << Rails.root.join("app", "assets", "builds")
end
