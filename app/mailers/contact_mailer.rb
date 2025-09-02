class ContactMailer < ApplicationMailer
  # with(contact: Contact) を受け取る想定
  def notify_admin
    contact = params.fetch(:contact)

    # ★ これを追加（テンプレが @contact.* を参照できるようにする）
    @contact = contact

    reply_to_addr = @contact.email.presence || ENV["RESEND_REPLY_TO"]

    mail(
      to: ENV.fetch("CONTACT_TO", "morikko0124@yahoo.co.jp"),
      reply_to: reply_to_addr,
      subject: "[EMOMU] お問い合わせ"
    )
  end
end
