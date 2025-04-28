OmniAuth.config.logger = Rails.logger
OmniAuth.config.on_failure = Proc.new { |env|
  Rails.logger.error "[OmniAuth] Failure: #{env['omniauth.error.type']} - #{env['omniauth.error']}"
}

OmniAuth.config.full_host = lambda do |env|
  "https://moriappli-emotion.com"
end
Rails.application.config.middleware.use OmniAuth::Builder do
  OmniAuth.config.allowed_request_methods = [:get, :post]  # ← ここに移動

  provider :github, ENV["GITHUB_CLIENT_ID"], ENV["GITHUB_CLIENT_SECRET"], setup: lambda { |env|
    session = env['rack.session']
    Rails.logger.debug "🔍 [OmniAuth Setup] session before setting state: #{session.to_hash}"

    if session.nil?
      Rails.logger.error "❌ session が nil です！"
    else
      Rails.logger.info "✅ session は存在しています"
    end

    session['omniauth.state'] ||= SecureRandom.hex(24)
    Rails.logger.debug "🔍 [OmniAuth Setup] session['omniauth.state'] after: #{session['omniauth.state']}"
  }

  # provider :google_oauth2, ENV["GOOGLE_CLIENT_ID"], ENV["GOOGLE_CLIENT_SECRET"], {
  #   scope: "email, profile",
  #   prompt: "select_account",
  #   setup: lambda { |env|
  #     session = env['rack.session']
  #     Rails.logger.debug "🔍 [OmniAuth Setup] Google session before setting state: #{session.to_hash}"

  #     if session.nil?
  #       Rails.logger.error "❌ Google session が nil です！"
  #     else
  #       Rails.logger.info "✅ Google session は存在しています"
  #     end

  #     session['omniauth.state'] ||= SecureRandom.hex(24)
  #     Rails.logger.debug "🔍 [OmniAuth Setup] Google session['omniauth.state'] after: #{session['omniauth.state']}"
  #   }
  # }

  provider :facebook, ENV["FACEBOOK_CLIENT_ID"], ENV["FACEBOOK_CLIENT_SECRET"], {
    scope: "email, public_profile",
    info_fields: "email, name",
    secure_image_url: true,
    image_size: 'large',
    setup: lambda { |env|
      session = env['rack.session']
      Rails.logger.debug "🔍 [OmniAuth Setup] Facebook session before setting state: #{session.to_hash}"

      session['omniauth.state'] ||= SecureRandom.hex(24)
      Rails.logger.debug "🔍 [OmniAuth Setup] Facebook session['omniauth.state'] after: #{session['omniauth.state']}"
    }
  }
  # provider OmniAuth::Strategies::SoundCloud, ENV['SOUNDCLOUD_CLIENT_ID'], ENV['SOUNDCLOUD_SECRET'], {
  #   scope: "non-expiring",
  #   client_options: {
  #     site: "https://api.soundcloud.com",
  #     authorize_url: "https://secure.soundcloud.com/authorize",
  #     token_url: "https://secure.soundcloud.com/oauth/token"
  #   },
  #   callback_path: "/users/auth/soundcloud/callback"
  # }


end
