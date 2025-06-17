class Users::RegistrationsController < Devise::RegistrationsController
  before_action :ensure_current_user, only: [ :edit, :update ]
  before_action :skip_current_password_validation, only: [ :update ]

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

  def update_resource(resource, params)
    # Cloudinary（本番環境）対応
    if params[:avatar_url].present?
      resource.avatar_url = params.delete(:avatar_url)
    end

    # 開発環境：cropped_avatar_dataがあればActiveStorageへattach
    if params[:cropped_avatar_data].present?
      data = params.delete(:cropped_avatar_data)
      if data =~ /^data:(.*?);base64,(.*)$/
        ext = $1.split("/").last
        decoded = Base64.decode64($2)
        tempfile = Tempfile.new([ "avatar", ".#{ext}" ], binmode: true)
        tempfile.write(decoded)
        tempfile.rewind
        resource.avatar.attach(io: tempfile, filename: "avatar.#{ext}")
        tempfile.close
        resource.avatar_url = nil # ActiveStorage優先
      end
    end

    # 画像削除チェック
    if params.delete(:remove_avatar) == "1"
      resource.avatar_url = nil
      resource.avatar.purge if resource.avatar.attached?
    end

    # その他の属性を更新
    resource.update(params)
  end

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
            :cropped_avatar_data,
            :remove_avatar
          )
  end

  def ensure_current_user
    if resource != current_user
      flash[:alert] = "他のユーザーのプロフィールは編集できません"
      redirect_to emotion_logs_path
    end
  end
end
