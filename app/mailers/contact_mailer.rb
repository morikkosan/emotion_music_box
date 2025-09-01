# app/mailers/contact_mailer.rb
class ContactMailer < ApplicationMailer
  def notify_admin
    @contact = params[:contact]  # Contact or {name:, email:, message:}

    name    = @contact.respond_to?(:name)    ? @contact.name    : @contact[:name]
    email   = @contact.respond_to?(:email)   ? @contact.email   : @contact[:email]
    message = @contact.respond_to?(:message) ? @contact.message : @contact[:message]
    @name = name
    @message = message

    mail(
      to: "morikko0124@gmail.com",
      subject: "【お問い合わせ】新規メッセージが届きました",
      # From は ApplicationMailer（Yahoo）を継承
      reply_to: email.presence || "morikko0124@yahoo.co.jp",
      message_id: "<contact-#{SecureRandom.hex(16)}@moriappli-emotion.com>"
    )
  end
end
