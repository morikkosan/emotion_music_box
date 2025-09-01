# app/mailers/contact_mailer.rb
class ContactMailer < ApplicationMailer
  # controller 側で: ContactMailer.with(contact: params[:contact]).notify_admin.deliver_now を想定
  def notify_admin
    @contact = params[:contact] # Contactオブジェクト or {name:, email:, message:} のどちらも想定

    # 両対応：オブジェクトなら .name、ハッシュなら [:name]
    name    = @contact.respond_to?(:name)    ? @contact.name    : @contact[:name]
    email   = @contact.respond_to?(:email)   ? @contact.email   : @contact[:email]
    message = @contact.respond_to?(:message) ? @contact.message : @contact[:message]

    # ビューでも使えるように
    @name    = name
    @message = message

    mail(
      to: "morikko0124@gmail.com",
      subject: "【お問い合わせ】新規メッセージが届きました",
      from: "Emotion Music Box <no-reply@moriappli-emotion.com>",
      reply_to: email.presence || "no-reply@moriappli-emotion.com",
      message_id: "<contact-#{SecureRandom.hex(16)}@moriappli-emotion.com>"
    )
  end
end
