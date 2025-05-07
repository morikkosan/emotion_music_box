# app/controllers/users/registrations_controller.rb
class Users::RegistrationsController < Devise::RegistrationsController
  before_action :skip_current_password_validation, only: [:update]

  protected

  # Deviseのupdate_resourceをオーバーライド
  def update_resource(resource, params)
    Rails.logger.info "Update Params: #{params.inspect}"

    # Base64画像がある場合はActiveStorageに保存
    if params[:cropped_avatar_data].present?
      require "base64"
      image_data = params.delete(:cropped_avatar_data)
      decoded_image = Base64.decode64(image_data.sub(/^data:image\/\w+;base64,/, ""))
      io = StringIO.new(decoded_image)
      resource.avatar.attach(io: io, filename: "cropped_avatar.png", content_type: "image/png")
    end

    # 画像削除チェックがあればpurge
    if params.delete(:remove_avatar) == "1"
      resource.avatar.purge if resource.avatar.attached?
    end

    # 他の属性を更新
    if resource.update(params)
      Rails.logger.info "User successfully updated"
    else
      Rails.logger.info "Update failed: #{resource.errors.full_messages.join(', ')}"
      # エラー時はDevise標準の動作に戻す
      clean_up_passwords resource
      set_minimum_password_length
      respond_with resource
    end
  end

  # OAuthユーザーはcurrent_passwordをスキップ
  def skip_current_password_validation
    if params[:user] && (params[:user][:provider].present? || params[:user][:uid].present?)
      params[:user].delete(:current_password)
    end
  end

  private

  # サインアップ時に許可するパラメータ
  def sign_up_params
    params.require(:user)
          .permit(:name, :email, :password, :password_confirmation, :gender, :age)
  end

  # アカウント更新時に許可するパラメータ
  def account_update_params
    params.require(:user)
          .permit(
            :name, :email,
            :password, :password_confirmation, :current_password,
            :gender, :age,
            :avatar, :remove_avatar, :cropped_avatar_data
          )
  end
end
