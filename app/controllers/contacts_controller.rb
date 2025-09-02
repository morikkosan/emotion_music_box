# /app/controllers/contacts_controller.rb
class ContactsController < ApplicationController
  def new
    @contact = Contact.new
  end

  def create
    @contact = Contact.new(contact_params)

    if @contact.valid?
      begin
        ContactMailer.with(contact: @contact).notify_admin.deliver_now
        redirect_to emotion_logs_path, notice: "お問い合わせ内容を送信しました。"
      rescue => e
        Rails.logger.error("[ContactMailer] send failed: #{e.class}: #{e.message}\n#{e.backtrace.join("\n")}")
        redirect_to contact_path, alert: "メール送信に失敗しました。しばらくしてからもう一度お試しください。"
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  def contact_params
    params.require(:contact).permit(:name, :email, :message)
  end
end
