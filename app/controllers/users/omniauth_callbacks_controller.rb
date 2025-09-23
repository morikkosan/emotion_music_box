# app/controllers/users/omniauth_callbacks_controller.rb
class Users::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  skip_before_action :verify_authenticity_token, only: %i[soundcloud]

  # SoundCloud 認証（メイン）
  def soundcloud
    oauth = request.env["omniauth.auth"]

    unless oauth && oauth["info"]
      flash[:alert] = "SoundCloud認証に失敗しました。"
      redirect_to root_path and return
    end

    log_oauth_debug(oauth) # 本番では出ない安全なデバッグログ

    @user = User.from_omniauth(oauth)

    if @user.persisted?
      # 有効期限は nil の可能性があるため to_i 経由で安全に
      expires_at = oauth.dig(:credentials, :expires_at) || oauth.dig("credentials", "expires_at")
      @user.update!(
        soundcloud_token:           oauth.dig(:credentials, :token)           || oauth.dig("credentials", "token"),
        soundcloud_refresh_token:   oauth.dig(:credentials, :refresh_token)   || oauth.dig("credentials", "refresh_token"),
        soundcloud_token_expires_at: expires_at ? Time.at(expires_at.to_i) : nil
      )

      sign_in @user
      flash[:notice] = "SoundCloudでログインしました！"
      redirect_to(mobile_device? ? emotion_logs_path(view: "mobile") : emotion_logs_path)
    else
      session["devise.soundcloud_data"] = oauth.except(:extra)
      redirect_to mobile_device? ? new_user_registration_url(view: "mobile") : new_user_registration_url
    end
  end

  # GETの誤リクエスト対策
  def passthru
    if request.get? && request.path.include?("soundcloud")
      render status: :method_not_allowed, plain: "SoundCloud requires POST request"
    else
      super
    end
  end

  def failure
    flash[:alert] = "SoundCloudログインがキャンセルされました。もう一度ログインをするか、ログイン画面先でSign out!を押してください"
    redirect_to root_path
  end

  private

  # 本番では一切出さない・トークンはマスクして debug にだけ出す
  def log_oauth_debug(oauth)
    return if Rails.env.production?

    creds = oauth.try(:credentials) || {}
    Rails.logger.debug "🔹 OAuth Callback Started for SoundCloud"
    Rails.logger.debug "🔹 basic info present: #{oauth['info'].present?}"
    Rails.logger.debug "🔑 token: #{mask(creds.try(:token))}"
    Rails.logger.debug "🔁 refresh_token: #{mask(creds.try(:refresh_token))}"
    if (exp = creds.try(:expires_at)).present?
      Rails.logger.debug "⏳ expires_at(unix): #{exp}"
      Rails.logger.debug "⏰ expires_at(readable): #{Time.at(exp.to_i)}"
    end
  end

  def mask(str)
    s = str.to_s
    return "(nil)" if s.empty?
    # 先頭4桁＋…＋末尾3桁だけ残す
    head = s[0, 4]
    tail = s[-3, 3]
    "#{head}...#{tail}"
  end
end
