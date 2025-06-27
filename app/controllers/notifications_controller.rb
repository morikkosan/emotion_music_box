# app/controllers/notifications_controller.rb
class NotificationsController < ApplicationController
  def test
    user = User.find(params[:id]) # 通知を送りたい相手のユーザーID

    return render plain: "No subscription" unless user.push_subscription.present?

    Webpush.payload_send(
      endpoint: user.push_subscription.endpoint,
      message: {
        title: "通知テスト 🎉",
        options: {
          body: "リアクション通知のテストです！",
          icon: "/icon.png", # 必要に応じて画像パスを
          data: {
            path: "/emotion_logs" # 通知クリック時に開くパス
          }
        }
      }.to_json,
      p256dh: user.push_subscription.key_p256dh,
      auth: user.push_subscription.key_auth,
      vapid: {
        subject: "mailto:you@example.com",
        public_key: ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      }
    )

    render plain: "通知送信しました"
  end


    # notifications_controller.rb に追記
  def public_key
    render json: { publicKey: ENV['VAPID_PUBLIC_KEY'] }
  end


end
