# Be sure to restart your server when you modify this file.

Rails.application.configure do
  # Generate nonces for script and style blocks
  config.content_security_policy_nonce_generator = ->(request) { SecureRandom.base64(16) }
  config.content_security_policy_nonce_directives = %w(script-src style-src)

  # Define an application-wide content security policy
  config.content_security_policy do |policy|
    policy.default_src :self, :https

    policy.font_src    :self, :https, "https://fonts.gstatic.com"
    # ▼ ここを 'unsafe-inline' を足してモーダルの inline style を許可
    policy.style_src   :self, :https, "https://fonts.googleapis.com", "'unsafe-inline'"

    policy.img_src     :self, :https,
                       "https://res.cloudinary.com", :data,
                       "https://cf-media.sndcdn.com", "https://i1.sndcdn.com"

    policy.object_src  :none
    # script は引き続き nonce 運用（inline <script> 置くなら <script nonce="<%= content_security_policy_nonce %>">）
    policy.script_src  :self, :https

    policy.base_uri    :self
    policy.frame_src   :self, :https, "https://w.soundcloud.com"
    policy.connect_src :self, :https, "https://api.soundcloud.com"
    # policy.report_uri "/csp-violation-report-endpoint"
  end

  # Set to true if you want to only report violations without enforcing the policy.
  config.content_security_policy_report_only = false
end
