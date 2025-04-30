require "active_support/core_ext/integer/time"

Rails.application.configure do
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
  config.hosts << "emotion-music-box.onrender.com"

  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.server_timing = true
  config.action_controller.perform_caching = true
  config.action_controller.enable_fragment_cache_logging = true
  # config.active_storage.service = :local
  config.action_mailer.raise_delivery_errors = false
  config.action_mailer.perform_caching = false
  config.active_record.migration_error = :page_load
  config.active_record.verbose_query_logs = true
  config.active_support.deprecation = :log
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []
  config.assets.debug = true
  config.assets.quiet = true
  config.action_view.annotate_rendered_view_with_filenames = true
  config.action_controller.raise_on_missing_callback_actions = true
  config.assets.paths << Rails.root.join("app", "assets", "builds")

  Rails.logger.info "🔍 ENV[\"DB_NAME\"]: #{ENV['DB_NAME']}"
Rails.logger.info "🔍 ENV[\"DB_USER\"]: #{ENV['DB_USER']}"
Rails.logger.info "🔍 ENV[\"DB_PASSWORD\"]: #{ENV['DB_PASSWORD']}"
Rails.logger.info "🔍 ENV[\"DB_HOST\"]: #{ENV['DB_HOST']}"
Rails.logger.info "🔍 ENV[\"DB_PORT\"]: #{ENV['DB_PORT']}"

end
