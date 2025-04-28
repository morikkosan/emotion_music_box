Rails.application.config.session_store :redis_session_store,
  servers: ENV['REDIS_URL'],
  expire_after: 90.minutes,
  key: "_myapp_session",
  secure: true,
  same_site: :none
