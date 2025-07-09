Rails.application.configure do 
  config.content_security_policy do |policy| 
    policy.default_src :self, :https 
    policy.font_src    :self, :https, "https://fonts.gstatic.com" 
    policy.style_src   :self, :https, "https://fonts.googleapis.com" 
    policy.img_src     :self, :https, "https://res.cloudinary.com", :data 
    policy.object_src  :none 
    policy.script_src  :self, :https 
    # 必要に応じて report_uri も指定可能 
    # policy.report_uri "/csp-violation-report-endpoint" 
  end 

  config.content_security_policy_nonce_generator = ->(request) { request.session.id.to_s } 
  config.content_security_policy_nonce_directives = %w(script-src style-src) 

  config.content_security_policy_report_only = true  # 最初はreport_only: trueでテスト推奨
end
