# /config/initializers/resend.rb

# このファイルを明示 require（安全のため）
require Rails.root.join("app/mailers/delivery_methods/resend_delivery_method").to_s

require "resend"

# Render の Environment から読み込み
Resend.api_key = ENV["RESEND_API_KEY"]

# ActionMailer に独自 delivery method を登録
ActionMailer::Base.add_delivery_method :resend, ::DeliveryMethods::ResendDeliveryMethod

Rails.logger.info "[Resend] API key present? #{Resend.api_key.present?}"
Rails.logger.info "[Resend] FROM=#{ENV['RESEND_FROM'].presence || '(not set)'}"
