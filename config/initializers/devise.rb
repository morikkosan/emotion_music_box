Devise.setup do |config|
  ENV['SOUNDCLOUD_REDIRECT_URI'] = 'https://moriappli-emotion.com/auth/soundcloud/callback'
  Rails.logger.info "🛠 強制固定 ENV['SOUNDCLOUD_REDIRECT_URI']: #{ENV['SOUNDCLOUD_REDIRECT_URI']}"

  config.mailer_sender = 'please-change-me-at-config-initializers-devise@example.com'
  require 'devise/orm/active_record'

  config.case_insensitive_keys = [:email]
  config.strip_whitespace_keys = [:email]
  config.skip_session_storage = [:http_auth]
  config.stretches = Rails.env.test? ? 1 : 12
  config.reconfirmable = true
  config.expire_all_remember_me_on_sign_out = true
  config.password_length = 6..128
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/
  config.reset_password_within = 6.hours
  config.sign_out_via = :delete

  config.omniauth_path_prefix = "/auth"

  # 🔧 OmniAuthのfull_hostを完全に固定で指定
  OmniAuth.config.full_host = 'https://moriappli-emotion.com'
  Rails.logger.info "🌐 OmniAuth full_host set to: #{OmniAuth.config.full_host}"

  OmniAuth.config.before_request_phase do |env|
    Rails.logger.info "🔍 Sending redirect_uri to SoundCloud: #{env['omniauth.strategy'].callback_url}"
  end

  OmniAuth.config.allowed_request_methods = [:post, :get]
  OmniAuth.config.logger = Rails.logger
  Rails.logger.info "🔧 Callback URL being used: #{ENV['SOUNDCLOUD_REDIRECT_URI']}"

  # SoundCloud OAuth設定（シンプル＆確実に指定）
  config.omniauth :soundcloud,
  ENV['SOUNDCLOUD_CLIENT_ID'],
  ENV['SOUNDCLOUD_CLIENT_SECRET'],
  callback_url: ENV['SOUNDCLOUD_REDIRECT_URI'],
  strategy_class: OmniAuth::Strategies::SoundCloud,
  client_options: {
    site: 'https://api.soundcloud.com',
    authorize_url: 'https://secure.soundcloud.com/authorize',
    token_url: 'https://secure.soundcloud.com/oauth/token'
  },
  token_params: {
    redirect_uri: ENV['SOUNDCLOUD_REDIRECT_URI'] # ← これ追加！
  },
  pkce: false


  # # Google OAuthもそのまま残す（特に変更は不要）
  # config.omniauth :google_oauth2,
  #                 ENV['GOOGLE_CLIENT_ID'],
  #                 ENV['GOOGLE_CLIENT_SECRET'],
  #                 scope: "email, profile",
  #                 prompt: "select_account"
end
