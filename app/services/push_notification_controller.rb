require 'web_push'

class PushNotifier
  def self.send_web_push(user, title:, body:)
    Rails.logger.info("🔔 send_web_push 呼ばれました user_id=#{user.id} title=#{title.inspect} body=#{body.inspect}")

    unless user.push_enabled?
      Rails.logger.info("❗ user_id=#{user.id} はPush通知無効です。通知は送信されません。")
      return
    end

    unless user.push_subscription.present?
      Rails.logger.info("❗ user_id=#{user.id} にPushSubscriptionがありません。通知は送信されません。")
      return
    end

    Rails.logger.info("Push通知送信開始 user_id=#{user.id} endpoint=#{user.push_subscription.endpoint}")

    raw_key = ENV['VAPID_PRIVATE_KEY'].to_s.strip.gsub('\\n', "\n")
    private_key = OpenSSL::PKey::EC.new(raw_key)

    WebPush.payload_send(
      endpoint: user.push_subscription.endpoint,
      message: JSON.generate({ title: title, body: body }),
      p256dh: user.push_subscription.key_p256dh,
      auth: user.push_subscription.key_auth,
      vapid: {
        subject: "mailto:admin@moriappli-emotion.com", # 空文字は避ける
        public_key: ENV['VAPID_PUBLIC_KEY'],
        private_key: private_key
      }
    )

    Rails.logger.info("✅ Push通知送信成功 user_id=#{user.id}")
  rescue => e
    Rails.logger.warn("❌ Push通知失敗 user_id=#{user.id}: #{e.class} - #{e.message}")
    raise
  end
end
