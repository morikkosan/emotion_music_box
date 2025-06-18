class ContactsController < ApplicationController
  def new
    @contact = Contact.new
  end

  def create
    @contact = Contact.new(contact_params)
    if @contact.valid?
      ContactMailer.with(contact: @contact).notify_admin.deliver_now
      redirect_to emotion_logs_path, notice: "お問い合わせ内容を送信しました。"
    else
      render :new, status: :unprocessable_entity
    end
  end


  private
  def contact_params
    params.require(:contact).permit(:name, :email, :message)
  end
end

