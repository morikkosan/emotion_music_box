# /config/environments/production.rb
require "active_support/core_ext/integer/time"

Rails.application.configure do
  # --- 本番設定 ---
  # 本番はコードをキャッシュし、オートリロードは無効
  config.cache_classes = true
  config.reload_classes_only_on_change = true
  config.file_watcher = ActiveSupport::EventedFileUpdateChecker

  # ===== アセット =====
  # cssbundling-rails(dart-sass)で事前ビルドするため、Sprockets 側のCSS圧縮は無効化
  config.assets.css_compressor = nil

  # 本番はランタイムコンパイルを避ける（プリコンパイル済みのみ配信）
  config.assets.compile = false

  # 指紋付き
  config.assets.digest = true
  config.assets.debug = false
  config.assets.quiet = true

  # builds をSprocketsの探索パスに追加（esbuild/sassの出力を拾う）
  config.assets.paths << Rails.root.join("app", "assets", "builds")

  # 指紋付きアセットを強キャッシュ（壊れません）
  config.public_file_server.headers = {
    "Cache-Control" => "public, max-age=31536000, immutable"
  }

  # HSTS
  config.force_ssl = true
  config.ssl_options = { hsts: { expires: 1.year, preload: true, subdomains: true } }

  # ホスト・URL
  config.action_controller.perform_caching = true
  config.action_controller.enable_fragment_cache_logging = true
  config.action_controller.raise_on_missing_callback_actions = true
  config.consider_all_requests_local = false
  config.server_timing = true
  config.hosts << "moriappli-emotion.com"

  # Active Storage
  config.active_storage.service = :cloudinary

  # DB / ログ
  config.active_record.migration_error = :page_load
  config.active_record.verbose_query_logs = true
  config.log_level = :debug
  config.logger = ActiveSupport::Logger.new(STDOUT)
  config.logger.formatter = config.log_formatter

  # ルーティング/URL 既定
  config.action_mailer.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }
  Rails.application.routes.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }
  config.action_mailer.asset_host = "https://moriappli-emotion.com"

  # OmniAuth のフルホストも統一
  OmniAuth.config.full_host = "https://moriappli-emotion.com"

  # Lograge（ログ整形）
  config.lograge.enabled = true
  # config.lograge.formatter = Lograge::Formatters::Json.new
  # config.lograge.custom_options = lambda { |event| { time: Time.now } }

  # ローディング/イager load
  config.enable_reloading = false
  config.eager_load = true

  # Deprecation
  config.action_view.annotate_rendered_view_with_filenames = true
  config.active_support.deprecation = :log
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []

  # ====== メール（Resend） ======
  config.action_mailer.perform_deliveries = true
  config.action_mailer.raise_delivery_errors = true
  config.action_mailer.perform_caching = false
  config.action_mailer.delivery_method = :resend
  # Fromは ApplicationMailer で集約
end
