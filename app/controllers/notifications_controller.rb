# app/controllers/notifications_controller.rb
class NotificationsController < ApplicationController
  before_action :authenticate_user!

  # GET /notifications/test/:id
  # 任意ユーザーにテスト通知を送る（管理UIやデバッグ用）
  def test
    user = User.find(params[:id])
    return render plain: "No subscription" unless user.push_subscription.present?

    WebPush.payload_send(
      endpoint: user.push_subscription.endpoint,
      message: {
        title: "通知テスト 🎉",
        options: {
          body: "リアクション通知のテストです！",
          icon: "/icon.png",
          data: { path: "/emotion_logs" }
        }
      }.to_json,
      p256dh: user.push_subscription.key_p256dh,
      auth:   user.push_subscription.key_auth,
      vapid: {
        subject:    "mailto:you@example.com",
        public_key: ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      }
    )

    render plain: "通知送信しました"
  end

  # GET /notifications/public_key
  def public_key
    render json: { publicKey: ENV['VAPID_PUBLIC_KEY'] }
  end

  # PATCH /enable_push_notifications
  def enable
    current_user.update!(push_enabled: true)
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

  # PATCH /disable_push_notifications
  def disable
    current_user.update!(push_enabled: false)
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

  # GET /notifications/test
  # 「通知テストを送信」メニュー（current_user宛て）
  def debug_emotion
    user = current_user
    unless user&.push_subscription.present?
      return redirect_back fallback_location: root_path, alert: "プッシュ購読がありません。まず通知をオンにしてください。"
    end

    WebPush.payload_send(
      endpoint: user.push_subscription.endpoint,
      message: {
        title: "通知テスト 🎉",
        options: {
          body: "これはテスト通知です",
          icon: "/icon.png",
          data: { path: "/emotion_logs" }
        }
      }.to_json,
      p256dh: user.push_subscription.key_p256dh,
      auth:   user.push_subscription.key_auth,
      vapid: {
        subject:    "mailto:you@example.com",
        public_key: ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      }
    )

    redirect_back fallback_location: root_path, notice: "通知テストを送信しました。"
  end

  # POST /push/emotion
  # JSから叩く想定がある時の保険用スタブ（未使用なら routes ごと削除でOK）
  def send_emotion_log
    # 必要になったらここで params を使って処理する
    head :ok
  end
end
