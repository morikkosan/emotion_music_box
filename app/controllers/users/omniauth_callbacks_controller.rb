class Users::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  skip_before_action :verify_authenticity_token, only: %i[soundcloud]

  # SoundCloud 認証（メイン）
  def soundcloud
    Rails.logger.debug "🔹 OAuth Callback Started for SoundCloud"
    Rails.logger.debug "🔹 Parameters received: #{params.inspect}"
    Rails.logger.debug "🔍 Current session data: #{session.to_hash}"
    
    

    oauth_data = request.env["omniauth.auth"]
    error_data = request.env["omniauth.error"]

if oauth_data.nil? || oauth_data["info"].nil?
  flash[:alert] = "SoundCloud認証に失敗しました。"
  redirect_to root_path and return
end

Rails.logger.debug "🧪 credentials: #{oauth_data.credentials&.inspect}"
Rails.logger.debug "🔑 トークン: #{oauth_data.credentials&.token}"
Rails.logger.debug "🔁 リフレッシュトークン: #{oauth_data.credentials&.refresh_token}"
Rails.logger.debug "⏳ 有効期限(UNIX): #{oauth_data.credentials&.expires_at}"
Rails.logger.debug "⏰ 有効期限(Readable): #{Time.at(oauth_data.credentials.expires_at) if oauth_data.credentials&.expires_at}"


    if oauth_data.nil? || oauth_data["info"].nil?
      # Rails.logger.error "❌ SoundCloud OAuth data is missing"
      flash[:alert] = "SoundCloud認証に失敗しました。"
      redirect_to root_path and return
    end

    Rails.logger.debug "🔍 OAuth data received: #{oauth_data.inspect}"
    Rails.logger.debug "🔑 トークン: #{oauth_data.credentials.token}"
    Rails.logger.debug "🔁 リフレッシュトークン: #{oauth_data.credentials.refresh_token}"
    Rails.logger.debug "⏳ 有効期限(UNIX): #{oauth_data.credentials.expires_at}"
    Rails.logger.debug "⏰ 有効期限(Readable): #{Time.at(oauth_data.credentials.expires_at)}"

    @user = User.from_omniauth(oauth_data)

if @user.persisted?
  @user.update!(
    soundcloud_token: oauth_data.credentials.token,
    soundcloud_refresh_token: oauth_data.credentials.refresh_token,
    soundcloud_token_expires_at: Time.at(oauth_data.credentials.expires_at)
  )

  sign_in @user
  flash[:notice] = "SoundCloudでログインしました！"
  if mobile_device?
    redirect_to emotion_logs_path(view: "mobile")
  else
    redirect_to emotion_logs_path
  end
else
  session["devise.soundcloud_data"] = oauth_data.except(:extra)
  # こちらも同じようにスマホ判定で出し分けてもOK
  if mobile_device?
    redirect_to new_user_registration_url(view: "mobile")
  else
    redirect_to new_user_registration_url
  end
end
end



  #  GETの誤リクエスト対策
  def passthru
    if request.get? && request.path.include?("soundcloud")
      # Rails.logger.error " SoundCloudのOAuthは GET をサポートしていません"
      render status: 405, plain: "SoundCloud requires POST request"
    else
      super
    end
  end

  # ❗ OmniAuth失敗時のデフォルト（必要に応じて）
  def failure
    # Rails.logger.info " Users::OmniauthCallbacksController#failure が呼び出されました"
    flash[:alert] = "SoundCloudログインがキャンセルされました。もう一度ログインをするか、ログイン画面先でSign out!を押してください"
    redirect_to root_path
  end
end
