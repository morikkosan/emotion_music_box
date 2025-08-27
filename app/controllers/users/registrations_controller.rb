# app/controllers/users/registrations_controller.rb
require "base64"

class Users::RegistrationsController < Devise::RegistrationsController
  before_action :ensure_current_user, only: [:edit, :update]
  before_action :skip_current_password_validation, only: [:update]

  def update
    # 念のため Devise 流で自分を取り直す
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

  # 本番(CloudinaryのURL運用) と 開発/テスト(ActiveStorage運用) を安全に切り替え
  def update_resource(resource, params)
    remove = (params[:remove_avatar] == "1")

    if Rails.env.production?
      # === 本番: Cloudinary等のURL一本化 ===
      if remove
        # 削除指定: まずURLを無効化
        resource.avatar_url = nil if resource.respond_to?(:avatar_url=)
      elsif params[:avatar_url].present?
        # 通常更新: URLがあれば反映
        resource.avatar_url = params[:avatar_url] if resource.respond_to?(:avatar_url=)
      end

      # updateで上書きされないよう、削除時は :avatar_url を除外して保存
      update_attrs = params.except(:avatar, :cropped_avatar_data, :remove_avatar)
      update_attrs = update_attrs.except(:avatar_url) if remove

      resource.update(update_attrs)

    else
      # === 開発/テスト: ActiveStorageを使う想定 ===

      # Base64で来たトリミング済み画像を添付（来ている時だけ）
      if params[:cropped_avatar_data].present? &&
         resource.respond_to?(:avatar)
        data = params[:cropped_avatar_data]
        if data =~ /^data:(.*?);base64,(.*)$/
          ext      = $1.split("/").last
          decoded  = Base64.decode64($2)
          tempfile = Tempfile.new(["avatar", ".#{ext}"], binmode: true)
          begin
            tempfile.write(decoded)
            tempfile.rewind
            if resource.avatar.respond_to?(:attach)
              resource.avatar.attach(io: tempfile, filename: "avatar.#{ext}")
              # ActiveStorageを優先表示にするためURLは無効化
              resource.avatar_url = nil if resource.respond_to?(:avatar_url=)
            end
          ensure
            tempfile.close!
          end
        end
      end

      # 画像削除チェック（AS添付があればpurge、URLも無効化）
      if remove
        if resource.respond_to?(:avatar) &&
           resource.avatar.respond_to?(:attached?) &&
           resource.avatar.attached?
          resource.avatar.purge
        end
        resource.avatar_url = nil if resource.respond_to?(:avatar_url=)
      end

      # updateで上書きされないよう、削除時は :avatar_url を除外して保存
      update_attrs = params.except(:avatar, :cropped_avatar_data, :remove_avatar)
      update_attrs = update_attrs.except(:avatar_url) if remove

      # AS優先でないケースで、URLだけ更新することも一応許容（AS未添付時）
      if params[:avatar_url].present?
        as_attached = (resource.respond_to?(:avatar) &&
                       resource.avatar.respond_to?(:attached?) &&
                       resource.avatar.attached?)
        if !as_attached && !remove
          resource.avatar_url = params[:avatar_url] if resource.respond_to?(:avatar_url=)
        end
      end

      resource.update(update_attrs)
    end
  end

  def skip_current_password_validation
    return unless params[:user]

    # SoundCloudオンリーなら、連携ユーザーは current_password 不要にする
    if resource&.soundcloud_uid.present? || params[:user][:provider].present? || params[:user][:uid].present?
      params[:user].delete(:current_password)
    end
    # ※ update_resource では current_password を使っていないため、
    #   常に削除しても実挙動は変わりません。明示性のため条件を残しています。
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
    # /users/edit はIDを受けないので他人編集経路は基本なし。
    # nil安全のため、明示的に自分を resource にセット。
    self.resource = send(:"current_#{resource_name}")
    unless resource
      flash[:alert] = "ログインが必要です"
      redirect_to emotion_logs_path
    end
  end
end
