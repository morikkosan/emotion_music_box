class Users::RegistrationsController < Devise::RegistrationsController
  before_action :skip_current_password_validation, only: [:update]

  protected

  # Devise の update_resource をオーバーライド
  def update_resource(resource, params)
    Rails.logger.info "Update Params: #{params.inspect}"

    # Cloudinaryアップロード済みURLをavatar_urlカラムに保存
    if params[:avatar_url].present?
      resource.avatar_url = params.delete(:avatar_url)
    end

    # 画像削除チェック
    if params.delete(:remove_avatar) == "1"
      resource.avatar_url = nil
    end

    # 他の属性を更新（avatar_urlは直接代入済みなので除外）
    if resource.update(params)
      # avatar_urlの保存を確実に
      resource.save if resource.changed?

      Rails.logger.info "User successfully updated"
    else
      Rails.logger.info "Update failed: #{resource.errors.full_messages.join(', ')}"
      clean_up_passwords resource
      set_minimum_password_length
      respond_with resource
    end
  end

  # OAuthユーザーは current_password をスキップ
  def skip_current_password_validation
    if params[:user] && (params[:user][:provider].present? || params[:user][:uid].present?)
      params[:user].delete(:current_password)
    end
  end

  private

  def sign_up_params
    params.require(:user)
          .permit(:name, :email, :password, :password_confirmation, :gender, :age)
  end

  def account_update_params
    params.require(:user)
          .permit(
            :name, :email,
            :password, :password_confirmation, :current_password,
            :gender, :age,
            :avatar_url,  # ←URLだけ
            :remove_avatar
          )
  end
end
