# Be sure to restart your server when you modify this file.

Rails.application.configure do
  # ① Nonceは生成してOK
  config.content_security_policy_nonce_generator = ->(request) { SecureRandom.base64(16) }

  # ② ★ここが核心：style-src を nonce 対象から外す（script-src のみ）
  config.content_security_policy_nonce_directives = %w(script-src)

  # ③ ポリシー本体
  config.content_security_policy do |policy|
    policy.default_src :self, :https

    policy.font_src    :self, :https, "https://fonts.gstatic.com"
    # ④ ★style-src に 'unsafe-inline' を入れる（nonce を付けない）
    policy.style_src   :self, :https, "https://fonts.googleapis.com", :unsafe_inline

    policy.img_src     :self, :https,
                       "https://res.cloudinary.com", :data,
                       "https://cf-media.sndcdn.com", "https://i1.sndcdn.com"

    policy.object_src  :none
    policy.script_src  :self, :https   # ← script は nonce 運用でOK

    policy.base_uri    :self
    policy.frame_src   :self, :https, "https://w.soundcloud.com"
    policy.connect_src :self, :https, "https://api.soundcloud.com"
  end

  config.content_security_policy_report_only = false
end
