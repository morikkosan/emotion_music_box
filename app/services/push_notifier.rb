# app/services/push_notifier.rb
class PushNotifier
  def self.send_emotion_log(user, emotion:, track_name:, artist_name:, hp:)
    title = "🎵 新しい投稿通知"
    body  = "#{emotion}な気分で『#{track_name} / #{artist_name}』を投稿しました！(HP: #{hp})"
    send_web_push(user, title: title, body: body)
  end

  def self.send_web_push(user, title:, body:)
    return unless user.push_enabled? && user.push_subscription.present?

    Rails.logger.info("Push通知送信開始 user_id=#{user.id} endpoint=#{user.push_subscription.endpoint}")

    Webpush.payload_send(
      endpoint: user.push_subscription.endpoint,
      message: JSON.generate({ title: title, body: body }),
      p256dh: user.push_subscription.key_p256dh,
      auth: user.push_subscription.key_auth,
      vapid: {
        subject: "mailto:admin@moriappli-emotion.com",
        public_key: ENV['VAPID_PUBLIC_KEY'],
        private_key: ENV['VAPID_PRIVATE_KEY']
      }
    )
    Rails.logger.info("✅ Push通知送信成功 user_id=#{user.id}")
  rescue => e
    Rails.logger.warn("❌ Push通知失敗 user_id=#{user.id}: #{e.class} - #{e.message}")
  end
end
