# app/controllers/users/registrations_controller.rb
class Users::RegistrationsController < Devise::RegistrationsController
  before_action :skip_current_password_validation, only: [:update]

  protected

  # Devise の update_resource をオーバーライド
  def update_resource(resource, params)
    Rails.logger.info "Update Params: #{params.inspect}"

    # ----- アバター処理 -----
    if params[:cropped_avatar_data].present?
      image_data = params.delete(:cropped_avatar_data)

      if image_data.start_with?("data:image")                   # Base64 形式
        require "base64"
        decoded = Base64.decode64(image_data.sub(/^data:image\/\w+;base64,/, ""))
        io = StringIO.new(decoded)
        resource.avatar.attach(io: io,
                               filename: "cropped_avatar.png",
                               content_type: "image/png")
      elsif image_data =~ %r{\Ahttps?://}                       # Cloudinary secure_url
        require "open-uri"
        begin
          io       = URI.open(image_data)
          filename = File.basename(URI.parse(image_data).path.presence || "avatar.png")
          resource.avatar.attach(io: io, filename: filename)
        rescue => e
          Rails.logger.error "Cloudinary fetch failed: #{e.message}"
        end
      end
    end

    # 画像削除チェック
    if params.delete(:remove_avatar) == "1"
      resource.avatar.purge if resource.avatar.attached?
    end

    # ----- 他の属性を更新 -----
    if resource.update(params)
      Rails.logger.info "User successfully updated"
    else
      Rails.logger.info "Update failed: #{resource.errors.full_messages.join(', ')}"
      clean_up_passwords resource
      set_minimum_password_length
      respond_with resource
    end
  end

  # OAuth ユーザーは current_password をスキップ
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
