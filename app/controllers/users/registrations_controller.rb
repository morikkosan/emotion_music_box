class Users::RegistrationsController < Devise::RegistrationsController
    before_action :ensure_current_user, only: [:edit, :update]

  before_action :skip_current_password_validation, only: [:update]

def update
  self.resource = resource_class.to_adapter.get!(send(:"current_#{resource_name}").to_key)

  resource_updated = update_resource(resource, account_update_params)
  yield resource if block_given?
  if resource_updated
    bypass_sign_in resource, scope: resource_name
    redirect_to emotion_logs_path, notice: "プロフィールを更新しました"
  else
    clean_up_passwords resource
    set_minimum_password_length
    respond_with resource
  end
end


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

    # avatar_url, remove_avatar以外の属性を更新
    resource.update(params)
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
            :avatar_url,
            :remove_avatar
          )
  end

  def ensure_current_user
    # 万が一他のユーザーのプロフィールを編集しようとした場合
    if resource != current_user
      flash[:alert] = "他のユーザーのプロフィールは編集できません"
      redirect_to emotion_logs_path
    end
  end
end
