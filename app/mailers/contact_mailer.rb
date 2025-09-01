# app/mailers/contact_mailer.rb
class ContactMailer < ApplicationMailer
  # controller 側で: ContactMailer.with(contact: params[:contact]).notify_admin.deliver_now を想定
  def notify_admin
    @contact = params[:contact] # { name:, email:, message: } を想定

    mail(
      to: "morikko0124@gmail.com",
      subject: "【お問い合わせ】新規メッセージが届きました",
      # 念のため mail メソッド側でも from を明示（ApplicationMailer の default と一致）
      from: "Emotion Music Box <no-reply@moriappli-emotion.com>",
      # 管理者が「返信」したときに、ユーザー宛に返るように
      reply_to: (@contact && @contact[:email]).presence || "no-reply@moriappli-emotion.com",
      # スレッド安定化（任意だが推奨）
      message_id: "<contact-#{SecureRandom.hex(16)}@moriappli-emotion.com>"
    )
  end
end
