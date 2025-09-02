# app/mailers/application_mailer.rb
class ApplicationMailer < ActionMailer::Base
  # ドメイン認証が済むまでの暫定 → "onboarding@resend.dev"
  # 認証後は no-reply@moriappli-emotion.com に切替
  default from: "Emotion Music Box <no-reply@moriappli-emotion.com>"
  layout "mailer"
end
