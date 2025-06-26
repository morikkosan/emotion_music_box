require 'webpush'

class PushNotificationController < ApplicationController
  protect_from_forgery with: :null_session

  # 投稿通知
  def send_emotion_log(user, emotion:, track_name:, artist_name:, hp:)
    title = "🎵 新しい投稿通知"
    body = "#{emotion}な気分で『#{track_name} / #{artist_name}』を投稿しました！(HP: #{hp})"
    send_web_push(user, title: title, body: body)
  end

  # コメント通知
  def send_comment_notification(user, commenter_name:, comment_body:)
    title = "💬 新しいコメントが届きました！"
    body = "#{commenter_name}さんのコメント: 『#{comment_body}』"
    send_web_push(user, title: title, body: body)
  end

  # ブックマーク通知
  def send_bookmark_notification(user, by_user_name:, track_name:)
    title = "🔖 ブックマーク通知"
    body = "#{by_user_name}さんがあなたの『#{track_name}』をブックマークしました！"
    send_web_push(user, title: title, body: body)
  end

  # お知らせ通知
  def send_news(user)
    latest_news = News.order(created_at: :desc).first
    return unless latest_news && user.push_subscription.present?

    title = "📢 #{latest_news.title}"
    body = latest_news.body
    send_web_push(user, title: title, body: body)
  end

  # 実際の送信処理（共通化）
  def send_web_push(user, title:, body:)
  return unless user.push_enabled? && user.push_subscription.present?

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
  rescue => e
    Rails.logger.warn("Push通知失敗: #{e.message}")
  end

  # テスト用アクション
  def debug_emotion
    user = User.find_by(email: "test@example.com")
    send_emotion_log(user, emotion: "嬉しい", track_name: "Lemon", artist_name: "米津玄師", hp: 90)
    render plain: "✅ emotion通知送信テスト完了"
  end

  def debug_comment
    user = User.find_by(email: "test@example.com")
    send_comment_notification(user, commenter_name: "ソル", comment_body: "今日の投稿すごく良かったです！")
    render plain: "✅ コメント通知送信テスト完了"
  end

  def debug_news
    user = User.find_by(email: "test@example.com")
    send_news(user)
    render plain: "✅ news通知送信テスト完了"
  end
end
