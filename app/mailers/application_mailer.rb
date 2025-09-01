# app/mailers/application_mailer.rb
class ApplicationMailer < ActionMailer::Base
  # ★ここを必ずあなたのドメインの認証済みアドレスに
  # 例: no-reply@moriappli-emotion.com（SendGrid/Mailgun/SES 等で認証）
  default from: "Emotion Music Box <no-reply@moriappli-emotion.com>"
  layout "mailer"
end
 