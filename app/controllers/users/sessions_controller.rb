class Users::SessionsController < Devise::SessionsController
  def destroy
    if current_user
      current_user.update(
        soundcloud_token: nil,
        soundcloud_refresh_token: nil,
        soundcloud_token_expires_at: nil
      )
      Rails.logger.info "🟢 SoundCloudトークンを初期化しました user_id: #{current_user.id}"
    end
    super
  end

  def new
    redirect_to emotion_logs_path
  end

  protected

  def after_sign_out_path_for(_resource_or_scope)
    flash[:notice] = "ログアウトしました。また来てね！"
    mobile_device? ? emotion_logs_path(view: "mobile") : emotion_logs_path
  end
end
