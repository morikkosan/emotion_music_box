# config/initializers/content_security_policy.rb

Rails.application.configure do
  config.content_security_policy_nonce_generator = ->(request) { SecureRandom.base64(16) }
  config.content_security_policy_nonce_directives = %w[script-src]

  config.content_security_policy do |policy|
    policy.default_src :self, :https

    policy.font_src  :self, :https, "https://fonts.gstatic.com"
    policy.style_src :self, :https, "https://fonts.googleapis.com", :unsafe_inline

    # ★ 画像は sndcdn 全域も許可（ジャケット類で別ホストに出る）
    policy.img_src   :self, :https,
                     "https://res.cloudinary.com", :data,
                     "https://cf-media.sndcdn.com", "https://i1.sndcdn.com",
                     "https://sndcdn.com", "https://*.sndcdn.com"

    policy.object_src :none

    # ★ SoundCloud API/Player/CDN へ fetch できるように拡張
    policy.connect_src :self, :https,
                       "https://api.soundcloud.com",
                       "https://api-v2.soundcloud.com",
                       "https://w.soundcloud.com",
                       "https://sndcdn.com", "https://*.sndcdn.com"

    # ★ <audio> で音声を読めるように（HLS/MP3は *.sndcdn.com から来る）
    policy.media_src :self, :https,
                     "https://sndcdn.com", "https://*.sndcdn.com", :data

    policy.base_uri  :self
    policy.frame_src :self, :https, "https://w.soundcloud.com"
  end

  config.content_security_policy_report_only = false
end
