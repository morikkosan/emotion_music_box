# app/services/simple_push_notifier.rb
require 'webpush'

class SimplePushNotifier
  def initialize(user)
    @user = user
  end

  def send_push(title:, body:)
    return unless @user.push_enabled? && @user.push_subscription.present?

    raw_key = ENV['VAPID_PRIVATE_KEY'].to_s.gsub('\\n', "\n")
    private_key = OpenSSL::PKey::EC.new(raw_key)

    Webpush.payload_send(
      endpoint: @user.push_subscription.endpoint,
      message: JSON.generate({ title: title, body: body }),
      p256dh: @user.push_subscription.key_p256dh,
      auth: @user.push_subscription.key_auth,
      vapid: {
        subject: "mailto:admin@moriappli-emotion.com",
        public_key: ENV['VAPID_PUBLIC_KEY'],
        private_key: private_key
      }
    )
    Rails.logger.info("✅ Push通知送信成功 user_id=#{@user.id}")
  rescue => e
    Rails.logger.warn("❌ Push通知失敗 user_id=#{@user.id}: #{e.class} - #{e.message}")
  end
end
