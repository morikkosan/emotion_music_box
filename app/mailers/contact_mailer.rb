class ContactMailer < ApplicationMailer
  def notify_admin
    @contact = params[:contact]
    mail(
      to: "morikko0124@gmail.com"
      subject: "【お問い合わせ】新規メッセージが届きました"
    )
  end
end
