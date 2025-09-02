# /app/mailers/application_mailer.rb
class ApplicationMailer < ActionMailer::Base
  # From は ENV で一元管理（Render 環境変数 RESEND_FROM）
  # 例: RESEND_FROM="Emotion Music Box <no-reply@moriappli-emotion.com>"
  default from: ENV.fetch("RESEND_FROM")

  layout "mailer"
end
