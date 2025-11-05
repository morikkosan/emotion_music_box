# config/initializers/content_security_policy.rb

Rails.application.configure do
  config.content_security_policy_nonce_generator = ->(request) { SecureRandom.base64(16) }
  config.content_security_policy_nonce_directives = %w[script-src]

  config.content_security_policy do |policy|
    policy.default_src :self, :https

    policy.font_src  :self, :https, "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"
    policy.style_src :self, :https, "https://fonts.googleapis.com", :unsafe_inline

    # 画像（SoundCloud系含む）
    policy.img_src   :self, :https,
                     "https://res.cloudinary.com", :data,
                     "https://cf-media.sndcdn.com", "https://i1.sndcdn.com",
                     "https://sndcdn.com", "https://*.sndcdn.com"

    policy.object_src :none

    # ★ ここを追加（今回の肝）：unsafe-inlineは付けない＝厳格
    policy.script_src :self, :https
    policy.script_src :self, :https, :unsafe_eval if Rails.env.development?

    # SoundCloud API/Player/CDN
    policy.connect_src :self, :https,
                       "https://api.soundcloud.com",
                       "https://api-v2.soundcloud.com",
                       "https://w.soundcloud.com",
                       "https://cf-hls-media.sndcdn.com",
                       "https://hls-media.sndcdn.com",
                       "https://sndcdn.com", "https://*.sndcdn.com"

    # <audio> 読み込み許可
    policy.media_src :self, :https,
                      "https://sndcdn.com", "https://*.sndcdn.com", :data, :blob

    policy.base_uri  :self
    policy.frame_src :self, :https, "https://w.soundcloud.com"
  end

  config.content_security_policy_report_only = false
end
