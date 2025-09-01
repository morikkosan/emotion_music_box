# config/environments/production.rb
require "active_support/core_ext/integer/time"

Rails.application.configure do
  # --- 本番環境でもコード／ビューを自動リロードする設定 ---
  # デプロイ本番の時は false / 開発では true
  config.cache_classes = true
  config.reload_classes_only_on_change = true
  config.file_watcher = ActiveSupport::EventedFileUpdateChecker

  # アセット
  config.assets.css_compressor = :sass               # CSSを圧縮
  config.assets.compile = true                       # プリコンパイルしたファイルだけ使う（※運用に応じて調整）
  config.assets.digest = true                        # キャッシュ防止のためファイル名にハッシュ
  config.assets.debug = false
  config.assets.quiet = true
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
  # メール内で画像等の絶対URLが必要なら（任意）
  config.action_mailer.asset_host = "https://moriappli-emotion.com"

  # OmniAuth のフルホストも統一
  OmniAuth.config.full_host = "https://moriappli-emotion.com"

  # Lograge（ログ整形）
  config.lograge.enabled = true
  # config.lograge.formatter = Lograge::Formatters::Json.new
  # config.lograge.custom_options = lambda { |event| { time: Time.now } }

  # デプロイ本番の時は false / 開発では true
  config.enable_reloading = false
  config.eager_load = true

  # Deprecation
  config.action_view.annotate_rendered_view_with_filenames = true
  config.active_support.deprecation = :log
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []

  # ====== ここから【メール送信（SendGrid）】の“確実に届く”設定 ======

  # 実際に送信する
  config.action_mailer.perform_deliveries = true

  # 不達原因の把握のため、まず true（安定後に false へ戻してOK）
  config.action_mailer.raise_delivery_errors = true

  # 差出人のデフォルト（ダブル保険。ApplicationMailer と一致）
  config.action_mailer.default_options = {
    from: "Emotion Music Box <no-reply@moriappli-emotion.com>"
  }

  # キャッシュは不要
  config.action_mailer.perform_caching = false

  # 配送方法を SMTP（SendGrid）に
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.smtp_settings = {
    # Render の「Environment」画面で下記を設定してください
    address:              ENV.fetch("SMTP_ADDRESS", "smtp.sendgrid.net"),
    port:                 ENV.fetch("SMTP_PORT", 587).to_i,
    user_name:            ENV.fetch("SMTP_USERNAME", "apikey"),   # SendGridは "apikey" 固定
    password:             ENV.fetch("SMTP_PASSWORD"),             # SendGrid の API Key
    domain:               ENV.fetch("SMTP_DOMAIN", "moriappli-emotion.com"),
    authentication:       :plain,
    enable_starttls_auto: true,
    open_timeout:         10,
    read_timeout:         10
  }

  # ====== メール設定 ここまで ======
end
