class ApplicationController < ActionController::Base
  protect_from_forgery with: Rails.env.test? ? :null_session : :exception
  # before_action :force_mobile_view
  before_action :refresh_soundcloud_token_if_needed

  # before_action :log_session_info
  # before_action :debug_session_state
  before_action :set_locale
  before_action :configure_permitted_parameters, if: :devise_controller?

  # # Devise コントローラーには適用しない
  # before_action :ensure_soundcloud_authenticated, unless: :devise_controller?

  # サウンドクラウド認証で失敗して戻ってきたとき
  def after_omniauth_failure_path_for(scope)
    flash[:alert] = "SoundCloudログインがキャンセルされました。もう一度ログインをしてください"
    root_path
  end

  helper_method :mobile_device?

  def mobile_device?
    !!(request.user_agent.to_s.downcase =~ /mobile|webos|iphone|android/)
  end

  def after_sign_in_path_for(resource)
    emotion_logs_path # または希望するトップページのパス
  end

  def chart_data
    render json: EmotionLog.group(:emotion).count
  end

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up,        keys: [:name, :gender, :age])
    devise_parameter_sanitizer.permit(:account_update, keys: [:name, :gender, :age])
  end

  private

  def refresh_soundcloud_token_if_needed
    return unless user_signed_in? # ← これを最初に！

    Rails.logger.info "▶️ SoundCloudトークン有効期限チェック開始 user_id: #{current_user.id}"

    return unless current_user.soundcloud_token_expires_at.present?

    if current_user.soundcloud_token_expires_at < Time.current
      Rails.logger.info "⏳ トークン期限切れ。リフレッシュ処理開始 user_id: #{current_user.id}"
      success = SoundCloudClient.refresh_token(current_user)

      if success
        Rails.logger.info "✅ トークンリフレッシュ成功 user_id: #{current_user.id}"
      else
        Rails.logger.error "❌ トークンリフレッシュ失敗 user_id: #{current_user.id}"
        sign_out current_user
        redirect_to new_user_session_path, alert: "SoundCloud認証が切れたため再ログインしてください"
        nil
      end
    else
      Rails.logger.info "✅ トークン有効期限内 user_id: #{current_user.id}"
    end
  end

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

  #     def force_mobile_view
  #   return if request.path.start_with?("/auth/")
  #   return unless request.get?
  #   return if request.xhr? || request.format.turbo_stream?
  #
  #   if request.user_agent =~ /Mobile|Android|iPhone/ && params[:view] != "mobile"
  #     redirect_to url_for(params.permit!.to_h.merge(view: "mobile")), allow_other_host: false and return
  #   end
  #
  #   if !(request.user_agent =~ /Mobile|Android|iPhone/) && params[:view] == "mobile"
  #     redirect_to url_for(params.permit!.to_h.except(:view)), allow_other_host: false and return
  #   end
  # end

  # def debug_session_state
  #   Rails.logger.info "🟢 Current session['omniauth.state']: #{session['omniauth.state']}"
  # end
  #
  # def log_session_info
  #   Rails.logger.debug "🔍 [SESSION] session_id: #{session.id}"
  #   Rails.logger.debug "🔍 [SESSION] Current session data: #{session.to_hash}"
  #   Rails.logger.debug "🟢 Current session['omniauth.state']: #{session['omniauth.state']}"
  # end

  # ★★★ ここを修正：キーワード引数 **opts を受け取り、super(**opts) に渡す ★★★
  def authenticate_user!(**opts)
    if user_signed_in?
      super(**opts)
    else
      request_format = request.format.symbol
      if request_format == :json
        render json: { error: "Unauthorized" }, status: :unauthorized
      else
        redirect_to new_user_session_path
      end
    end
  end
end
