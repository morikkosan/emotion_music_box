class Users::SessionsController < Devise::SessionsController
  def destroy
    Rails.logger.info "current_user: #{current_user.inspect}"
    super
    Rails.logger.info "AFTER super: flash: #{flash.inspect}"
  end

  def new
    @emotion_logs = EmotionLog.includes(:user, :bookmarks, :tags).order(date: :desc).limit(10)
    @mypage_title = "ようこそ音楽と感情を自由に表現する世界へ"
    redirect_to emotion_logs_path, notice: flash[:notice]
  end

  protected

  def after_sign_out_path_for(resource_or_scope)
    flash[:notice] = "ログアウトしました。また来てね！"
    if mobile_device?
      emotion_logs_path(view: 'mobile')
    else
      emotion_logs_path
    end
  end
end

