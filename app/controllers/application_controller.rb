class ApplicationController < ActionController::Base
  protect_from_forgery with: :exception

  before_action :log_session_info
  before_action :debug_session_state
  before_action :set_locale
  before_action :configure_permitted_parameters, if: :devise_controller?

  # # Devise コントローラーには適用しない
  # before_action :ensure_soundcloud_authenticated, unless: :devise_controller?

  # サウンドクラウド認証で失敗して戻ってきたとき
def after_omniauth_failure_path_for(scope)
  flash[:alert] = "SoundCloudログインがキャンセルされました。もう一度ログインをしてください"
  root_path
end

  def chart_data
    render json: EmotionLog.group(:emotion).count
  end

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:name, :gender, :age])
    devise_parameter_sanitizer.permit(:account_update, keys: [:name, :gender, :age])
  end

  private

  def ensure_soundcloud_authenticated
    # SoundCloud 認証済みフラグが立っていない場合にリダイレクトする
    unless session[:soundcloud_authenticated]
      flash[:alert] = "SoundCloud認証が必要です。"
      # すでに認証フロー中（/users/auth/soundcloud 系なら何もしない）
      unless request.path.start_with?("/users/auth/soundcloud")
        redirect_to users_auth_soundcloud_path and return
      end
    end
  end

  def set_locale
    I18n.locale = :ja
  end

  def debug_session_state
    Rails.logger.info "🟢 Current session['omniauth.state']: #{session['omniauth.state']}"
  end

  def log_session_info
    Rails.logger.debug "🔍 [SESSION] session_id: #{session.id}"
    Rails.logger.debug "🔍 [SESSION] Current session data: #{session.to_hash}"
    Rails.logger.debug "🟢 Current session['omniauth.state']: #{session['omniauth.state']}"
  end
end
