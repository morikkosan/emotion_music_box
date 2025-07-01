require 'webpush'

class PushNotifier
  def self.send_emotion_log(user, emotion:, track_name:, artist_name:, hp:)
    title = "🎵 新しい投稿通知"
    body = "#{emotion}な気分で『#{track_name} / #{artist_name}』を投稿しました！(HP: #{hp})"
    send_web_push(user, title: title, body: body)
  end

  def self.send_comment_notification(user, commenter_name:, comment_body:)
    title = "💬 新しいコメントが届きました！"
    body = "#{commenter_name}さんのコメント: 『#{comment_body}』"
    send_web_push(user, title: title, body: body)
  end

  def self.send_bookmark_notification(user, by_user_name:, track_name:)
    title = "🔖 ブックマーク通知"
    body = "#{by_user_name}さんがあなたの『#{track_name}』をブックマークしました！"
    send_web_push(user, title: title, body: body)
  end

  def self.send_news(user)
    latest_news = News.order(created_at: :desc).first
    return unless latest_news && user.push_subscription.present?

    title = "📢 #{latest_news.title}"
    body = latest_news.body
    send_web_push(user, title: title, body: body)
  end

  def self.send_web_push(user, title:, body:)
    return unless user.push_enabled? && user.push_subscription.present?

    Rails.logger.info("Push通知送信開始 user_id=#{user.id} endpoint=#{user.push_subscription.endpoint}")

    # VAPID_PRIVATE_KEYは改行コードを正しく処理しているか再確認
    raw_key = ENV['VAPID_PRIVATE_KEY'].to_s.strip.gsub('\\n', "\n")

    Webpush.payload_send(
      endpoint: user.push_subscription.endpoint,
      message: JSON.generate({ title: title, body: body }),
      p256dh: user.push_subscription.key_p256dh,
      auth: user.push_subscription.key_auth,
      vapid: {
        subject: "mailto:admin@moriappli-emotion.com",
        public_key: ENV['VAPID_PUBLIC_KEY'],
        private_key: raw_key
      }
    )

    Rails.logger.info("✅ Push通知送信成功 user_id=#{user.id}")
  rescue OpenSSL::PKey::PKeyError => e
    # pkeys are immutable エラーはここで特別にログ出す
    Rails.logger.warn("❌ Push通知失敗(OpenSSL PKeyError) user_id=#{user.id}: #{e.class} - #{e.message}")
    raise
  rescue => e
    Rails.logger.warn("❌ Push通知失敗 user_id=#{user.id}: #{e.class} - #{e.message}")
    raise
  end
end
