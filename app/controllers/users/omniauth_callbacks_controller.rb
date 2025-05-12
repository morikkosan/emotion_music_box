class Users::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  skip_before_action :verify_authenticity_token, only: %i[soundcloud]

  # SoundCloud 認証（メイン）
  def soundcloud
    Rails.logger.debug "🔹 OAuth Callback Started for SoundCloud"
    Rails.logger.debug "🔹 Parameters received: #{params.inspect}"
    Rails.logger.debug "🔍 Current session data: #{session.to_hash}"

    oauth_data = request.env["omniauth.auth"]
    error_data = request.env["omniauth.error"]
    Rails.logger.debug "🔍 omniauth.auth: #{oauth_data.inspect}"
    Rails.logger.debug "🔍 omniauth.error: #{error_data.inspect}" if error_data

    if oauth_data.nil? || oauth_data["info"].nil?
      Rails.logger.error "❌ SoundCloud OAuth data is missing"
      flash[:alert] = "SoundCloud認証に失敗しました。"
      redirect_to root_path and return
    end

    Rails.logger.debug "🔍 OAuth data received: #{oauth_data.inspect}"

    # 🔽 追加：トークンの情報を詳しく出力
    Rails.logger.debug "🔑 トークン: #{oauth_data.credentials.token}"
    Rails.logger.debug "🔁 リフレッシュトークン: #{oauth_data.credentials.refresh_token}"
    Rails.logger.debug "⏳ 有効期限(UNIX): #{oauth_data.credentials.expires_at}"
    Rails.logger.debug "⏰ 有効期限(Readable): #{Time.at(oauth_data.credentials.expires_at)}"
    

    # **SoundCloud情報からユーザーを検索 or 作成**
    @user = User.from_omniauth(oauth_data)

    if @user.persisted?
      # アクセストークンを保存
      @user.update!(
        soundcloud_token: oauth_data.credentials.token,
        soundcloud_refresh_token: oauth_data.credentials.refresh_token,
        soundcloud_token_expires_at: Time.at(oauth_data.credentials.expires_at)
      )

      sign_in @user
      flash[:notice] = "SoundCloudでログインしました！"

      # **認証成功時のリダイレクト**
      if @user.profile_completed?
        redirect_to root_path
      else
        Rails.logger.info "➡️ 初回ログインのためプロフィール入力ページへ遷移"

        redirect_to new_user_session_path
      end

    else
      session["devise.soundcloud_data"] = oauth_data.except(:extra)
      Rails.logger.error "❌ SoundCloud OAuth login failed. Redirecting to registration."
      redirect_to new_user_registration_url
    end
  end

  # **SoundCloud の GET リクエストを `POST` に変換**
  def passthru
    if request.get? && request.path.include?("soundcloud")
      Rails.logger.error "❌ SoundCloudのOAuthは GET をサポートしていません"
      render status: 405, plain: "SoundCloud requires POST request"
    else
      super
    end
  end
end
