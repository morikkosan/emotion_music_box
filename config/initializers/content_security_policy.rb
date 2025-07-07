# # Be sure to restart your server when you modify this file.

# Rails.application.configure do
#   config.content_security_policy do |policy|
#     policy.default_src :self, :https
#     policy.font_src    :self, :https, "https://fonts.gstatic.com"
#     policy.style_src   :self, :https, "https://fonts.googleapis.com"
#     policy.img_src     :self, :https, "https://res.cloudinary.com", :data
#     policy.object_src  :none
#     policy.script_src  :self, :https
#     # 必要に応じて追加
#   end

#   config.content_security_policy_nonce_generator = ->(request) { request.session.id.to_s }
#   config.content_security_policy_nonce_directives = %w(script-src style-src)
# end


# # === 以下参考用 ===
# # # Define an application-wide content security policy.
# # # See the Securing Rails Applications Guide for more information:
# # # https://guides.rubyonrails.org/security.html#content-security-policy-header
# #
# # config.content_security_policy_report_only = true
# # policy.report_uri "/csp-violation-report-endpoint"
