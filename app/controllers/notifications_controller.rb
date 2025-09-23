# app/controllers/notifications_controller.rb
class NotificationsController < ApplicationController
  before_action :authenticate_user!
  before_action :ensure_test_endpoints_allowed!, only: [ :test, :debug_emotion ]

  # GET /notifications/test/:id
  # 管理/デバッグ用：本番は「自分宛のみ」や無効化。dev/testは任意ID許可。
  def test
    user = find_target_user_for_test
    return render plain: "No subscription", status: :unprocessable_entity unless user&.push_subscription.present?

    if send_webpush(user, title: "通知テスト 🎉", body: "リアクション通知のテストです！", path: "/emotion_logs")
      render plain: "通知送信しました"
    else
      render plain: "通知送信に失敗しました", status: :internal_server_error
    end
  end

  # GET /notifications/public_key
  def public_key
    key = ENV["VAPID_PUBLIC_KEY"].to_s
    return head :no_content if key.blank?
    render json: { publicKey: key }
  end

  # PATCH /enable_push_notifications
  def enable
    current_user.update!(push_enabled: true)
    render_toggle
  end

  # PATCH /disable_push_notifications
  def disable
    current_user.update!(push_enabled: false)
    render_toggle
  end

  # GET /notifications/test_current (メニューからの自己向けテスト想定)
  def debug_emotion
    user = current_user
    unless user&.push_subscription.present?
      return redirect_back fallback_location: root_path, alert: "プッシュ購読がありません。まず通知をオンにしてください。"
    end

    if send_webpush(user, title: "通知テスト 🎉", body: "これはテスト通知です", path: "/emotion_logs")
      redirect_back fallback_location: root_path, notice: "通知テストを送信しました。"
    else
      redirect_back fallback_location: root_path, alert: "通知送信に失敗しました。"
    end
  end

  # POST /push/emotion（未使用なら routes ごと削除推奨）
  def send_emotion_log
    head :ok
  end

  private

  # ▼ 重複していたトグルUIの差し替えを共通化
  def render_toggle
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          turbo_stream.replace(
            "notification-toggle-desktop",
            partial: "shared/notification_toggle",
            locals: { frame_id: "notification-toggle-desktop" }
          ),
          turbo_stream.replace(
            "notification-toggle-mobile",
            partial: "shared/notification_toggle",
            locals: { frame_id: "notification-toggle-mobile" }
          )
        ]
      end
      format.html { redirect_back fallback_location: root_path }
    end
  end

  # ▼ WebPush送信の共通化＋例外ハンドリング
  def send_webpush(user, title:, body:, path:)
    sub = user.push_subscription
    return false unless sub && ENV["VAPID_PUBLIC_KEY"].present? && ENV["VAPID_PRIVATE_KEY"].present?

    WebPush.payload_send(
      endpoint: sub.endpoint,
      message: {
        title: title,
        options: { body: body, icon: "/icon.png", data: { path: path } }
      }.to_json,
      p256dh: sub.key_p256dh,
      auth:   sub.key_auth,
      vapid: {
        subject:    "mailto:you@example.com",
        public_key: ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      }
    )
    true
  rescue => e
    Rails.logger.error("WebPush failed: #{e.class}: #{e.message}")
    false
  end

  # ▼ 本番のテスト系エンドポイントは厳しめに
  def ensure_test_endpoints_allowed!
    return if Rails.env.development? || Rails.env.test?
    # production: /notifications/test/:id は自分自身のみ許可
    if action_name == "test"
      head :forbidden unless params[:id].to_s == current_user.id.to_s
    end
    # debug_emotion は current_user 宛のみなのでこのまま許可
  end

  def find_target_user_for_test
    if Rails.env.production?
      current_user # 本番は自分宛のみ
    else
      User.find_by(id: params[:id]) || current_user
    end
  end
end
