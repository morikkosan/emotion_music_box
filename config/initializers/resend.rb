# このファイルを明示 require（安全のため）
require Rails.root.join("app/mailers/delivery_methods/resend_delivery_method").to_s

Resend.api_key = ENV["RESEND_API_KEY"]

# ここは DeliveryMethods を使う
ActionMailer::Base.add_delivery_method :resend, ::DeliveryMethods::ResendDeliveryMethod

Rails.logger.info "[Resend] API key present? #{Resend.api_key.present?}"
Rails.logger.info "[Resend] FROM=#{ENV['RESEND_FROM'].presence || '(not set)'}"
