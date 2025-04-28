class Users::RegistrationsController < Devise::RegistrationsController
  before_action :skip_current_password_validation, only: [:update]

  protected

  def update_resource(resource, params)
    Rails.logger.info "Update Params: #{params.inspect}"
    
    if resource.update(params)
      Rails.logger.info "User successfully updated"
    else
      Rails.logger.info "Update failed: #{resource.errors.full_messages.join(', ')}"
    end
  end
  
  

  def skip_current_password_validation
    if params[:user][:provider].present? || params[:user][:uid].present?
      Rails.logger.info "Skipping current_password validation for API user"
      params.delete(:current_password)  # APIユーザーの場合、current_passwordを削除
    end
  end

  private

  # 新規登録時に `name` を許可
  def sign_up_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation, :gender, :age)
  end

  # プロフィール更新時に `name` を許可
  def account_update_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation, :current_password, :gender, :age)
  end
end
