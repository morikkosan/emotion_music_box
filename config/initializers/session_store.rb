Rails.application.config.session_store :cookie_store,
  key: "_myapp_session",
  secure: true,
  same_site: :none

