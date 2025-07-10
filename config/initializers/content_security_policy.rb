Rails.application.configure do
  config.content_security_policy_nonce_generator = ->(request) { SecureRandom.base64(16) }
  config.content_security_policy_nonce_directives = %w(script-src style-src)

  config.content_security_policy do |policy|
    policy.default_src :self, :https
    policy.font_src    :self, :https, "https://fonts.gstatic.com"
    policy.style_src   :self, :https, "https://fonts.googleapis.com"
    policy.img_src     :self, :https,
                       "https://res.cloudinary.com", :data,
                       "https://cf-media.sndcdn.com", "https://i1.sndcdn.com"
    policy.object_src  :none
    policy.script_src  :self, :https
    policy.base_uri    :self
    policy.frame_src   :self, :https, "https://w.soundcloud.com"
    policy.connect_src :self, :https, "https://api.soundcloud.com"
    # policy.report_uri "/csp-violation-report-endpoint"
  end

  config.content_security_policy_report_only = false
end
