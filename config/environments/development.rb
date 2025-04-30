require "active_support/core_ext/integer/time"

Rails.application.configure do
  # 変更①：production用ホストに変更（メールURLも含む）
  config.action_mailer.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }
  Rails.application.routes.default_url_options = { host: "moriappli-emotion.com", protocol: "https" }

  # 変更②：OmniAuthホストURLを固定
  OmniAuth.config.full_host = "https://moriappli-emotion.com"

  config.log_level = :debug
  config.force_ssl = true

  # 変更③：localhost → moriappli-emotion.com を許可
  config.hosts << "moriappli-emotion.com"

  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.server_timing = true
  config.action_controller.perform_caching = true
  config.action_controller.enable_fragment_cache_logging = true
  config.active_storage.service = :local
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
end
