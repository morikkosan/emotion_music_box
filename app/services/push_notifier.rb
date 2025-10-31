# app/services/push_notifier.rb
require "web_push"

class PushNotifier
  # 新しい順に30件だけ残す
  PRUNE_KEEP = 30

  # =========================
  # ドメイン固有の送信エントリ
  # =========================

  # 感情ログ投稿の通知
  def self.send_emotion_log(user, emotion:, track_name:, artist_name:, hp:)
    delta = hp.to_i
    sign  = delta >= 0 ? "+#{delta}" : delta.to_s
    title = "🎵 新しい投稿通知"
    body  = "#{emotion}な気分で『#{track_name} / #{artist_name}』を投稿しました！(HP: #{sign})"

    # ★DB保存（Pushの可否に関わらず作る）→ 30件キープ
    create_notification!(user,
      kind:  "emotion",
      title: title,
      body:  body,
      url:   "/emotion_logs"
    )

    # ★Push送信（既存ガードのまま／ここは一切変更なし）
    send_web_push(user, title: title, body: body)
  end

  # コメントされたとき
  def self.send_comment_notification(user, commenter_name:, comment_body:)
    title = "💬 新しいコメント"
    body  = "#{commenter_name}さんがあなたの投稿にコメントしました:「#{comment_body.truncate(20)}」"

    create_notification!(user,
      kind:  "comment",
      title: title,
      body:  body,
      url:   "/emotion_logs"
    )

    send_web_push(user, title: title, body: body)
  end

  # ブックマークされたとき
  def self.send_bookmark_notification(user, by_user_name:, track_name:)
    title = "⭐ ブックマークされました"
    body  = "#{by_user_name}さんが「#{track_name}」をブックマークしました"

    create_notification!(user,
      kind:  "bookmark",
      title: title,
      body:  body,
      url:   "/emotion_logs"
    )

    send_web_push(user, title: title, body: body)
  end

  # コメントにリアクションされたとき
  def self.send_reaction_notification(user, reactor_name:, comment_body:, reaction_kind:)
    title = "✨ リアクションが届きました"
    body  = "#{reactor_name}さんがあなたのコメント「#{comment_body.truncate(20)}」に#{reaction_kind}しました"

    create_notification!(user,
      kind:  "reaction",
      title: title,
      body:  body,
      url:   "/emotion_logs"
    )

    send_web_push(user, title: title, body: body)
  end

  # =========================
  # 共通WebPush本体（★既存どおり：変更しない）
  # =========================
  def self.send_web_push(user, title:, body:)
    return unless user.push_enabled? && user.push_subscription.present?
    Rails.logger.info("Push通知送信開始 user_id=#{user.id} endpoint=#{user.push_subscription.endpoint}")

    WebPush.payload_send(
      endpoint: user.push_subscription.endpoint,
      message: JSON.generate({ title: title, body: body }),
      p256dh:  user.push_subscription.key_p256dh,
      auth:    user.push_subscription.key_auth,
      vapid: {
        subject:    "mailto:admin@moriappli-emotion.com",
        public_key: ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      }
    )
    Rails.logger.info("✅ Push通知送信成功 user_id=#{user.id}")
  rescue => e
    Rails.logger.warn("❌ Push通知失敗 user_id=#{user.id}: #{e.class} - #{e.message}")
  end

  # =========================
  # DB保存＋古いの削除（30件キープ）
  # =========================
  def self.create_notification!(user, kind:, title:, body:, url:, read_at: nil)
    Notification.transaction do
      Notification.create!(
        user_id: user.id,
        kind:    kind,
        title:   title,
        body:    body,
        url:     url,
        read_at: read_at
      )
      prune_old_notifications!(user)
    end
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
    # ここで落としてPushを止めない（カウントだけ諦め、Pushは続行）
    Rails.logger.warn("⚠️ 通知レコード作成スキップ user_id=#{user.id}: #{e.class} - #{e.message}")
  end

  def self.prune_old_notifications!(user)
    ids = Notification.where(user_id: user.id)
                      .order(created_at: :desc)
                      .offset(PRUNE_KEEP)
                      .pluck(:id)
    Notification.where(id: ids).delete_all if ids.any?
  end
end
