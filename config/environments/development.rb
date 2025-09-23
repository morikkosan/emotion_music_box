# config/environments/development.rb
require "active_support/core_ext/integer/time"

Rails.application.configure do
  # 変更①：開発環境でもメールURLやルーティングのホストを本番ドメインに合わせる
  config.action_mailer.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }
  Rails.application.routes.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }

  # 変更②：OmniAuth のコールバックURLを本番ドメインに固定
  OmniAuth.config.full_host = "https://moriappli-emotion.com"

  # ログレベル
  config.log_level = :debug

  # SSL 強制（開発環境で mkcert を使う場合など）
  config.force_ssl = true

  # 変更③：hosts ヘッダに本番ドメインを許可
  config.hosts.clear
  config.hosts << "localhost"
  config.hosts << "127.0.0.1"
  config.hosts << "moriappli-emotion.com"

  # クラスのリロード・キャッシュ無効化（デフォルト）
  config.cache_classes = false
  config.eager_load = false
  config.enable_reloading = true

  # エラー詳細を表示
  config.consider_all_requests_local = true

  # 開発用であってもキャッシュロギングは有効に
  config.action_controller.perform_caching = true
  config.action_controller.enable_fragment_cache_logging = true

  # ストレージは :local
  config.active_storage.service = :local

  # メーラー設定
  config.action_mailer.raise_delivery_errors = false
  config.action_mailer.perform_caching = false
  config.action_mailer.smtp_settings = {
  user_name: "apikey",
  password: ENV["SENDGRID_API_KEY"],
  domain: "moriappli-emotion.com", # ←ここを統一
  address: "smtp.sendgrid.net",
  port: 587,
  authentication: :plain,
  enable_starttls_auto: true
}
  # マイグレーションエラーのページ表示
  config.active_record.migration_error = :page_load

  # SQL ログを詳しく
  config.active_record.verbose_query_logs = true

  # 非推奨警告の扱い
  config.active_support.deprecation = :log
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []

  # アセット
  config.assets.debug = true
  config.assets.quiet = true

  # ビューにファイル名を注釈
  config.action_view.annotate_rendered_view_with_filenames = true

  # コールバックアクションの欠如を例外で通知
  config.action_controller.raise_on_missing_callback_actions = true

  # ビルド済み JS/CSS のパスを追加（Rails 7＋jsbundling-rails）
  config.assets.paths << Rails.root.join("app", "assets", "builds")

  # サーバタイミング計測
  config.server_timing = true
end
