# app/services/push_notifier.rb
require "web_push"

class PushNotifier
  # ユーザーごとに保持する最大件数（必要なら ENV 化も可）
  PRUNE_KEEP = 30

  class << self
    # -------------------------
    # 感情ログ投稿の通知
    # -------------------------
    def send_emotion_log(user, emotion:, track_name:, artist_name:, hp:)
      delta = hp.to_i
      sign  = delta >= 0 ? "+#{delta}" : delta.to_s
      title = "🎵 新しい投稿通知"
      body  = "#{emotion}な気分で『#{track_name} / #{artist_name}』を投稿しました！(HP: #{sign})"

      # ★ 追記：DB 保存（一覧/未読バッジ用）
      create_notification!(
        user,
        kind:  :emotion_log,
        title: title,
        body:  body,
        url:   "/emotion_logs"
      )

      # ★ 既存の送信処理はそのまま
      send_web_push(user, title: title, body: body)
    end

    # -------------------------
    # コメント通知
    # -------------------------
    def send_comment_notification(user, commenter_name:, comment_body:)
      title = "💬 新しいコメント"
      body  = "#{commenter_name}さんがあなたの投稿にコメントしました:「#{comment_body.to_s.truncate(20)}」"

      create_notification!(
        user,
        kind:  :comment,
        title: title,
        body:  body,
        url:   "/emotion_logs"
      )

      send_web_push(user, title: title, body: body)
    end

    # -------------------------
    # ブックマーク通知
    # -------------------------
    def send_bookmark_notification(user, by_user_name:, track_name:)
      title = "⭐ ブックマークされました"
      body  = "#{by_user_name}さんが「#{track_name}」をブックマークしました"

      create_notification!(
        user,
        kind:  :bookmark,
        title: title,
        body:  body,
        url:   "/emotion_logs"
      )

      send_web_push(user, title: title, body: body)
    end

    # -------------------------
    # リアクション通知
    # -------------------------
    def send_reaction_notification(user, reactor_name:, comment_body:, reaction_kind:)
      title = "✨ リアクションが届きました"
      body  = "#{reactor_name}さんがあなたのコメント「#{comment_body.to_s.truncate(20)}」に#{reaction_kind}しました"

      create_notification!(
        user,
        kind:  :reaction,
        title: title,
        body:  body,
        url:   "/emotion_logs"
      )

      send_web_push(user, title: title, body: body)
    end

    # ======================================================
    # 共通：通知の DB 保存 ＋ 古い通知の間引き（最大30件残す）
    # ======================================================
    def create_notification!(user, kind:, title:, body:, url: nil)
      # Notification モデル前提（既に作成済みとのこと）
      user.notifications.create!(
        kind:   kind,
        title:  title,
        body:   body,
        url:    url,
        read_at: nil
      )
      prune_old_notifications!(user)  # 作成タイミングでも上限丸め
    rescue => e
      Rails.logger.error("Notification create failed: #{e.class}: #{e.message}")
    end

    def prune_old_notifications!(user)
      # 新しい順で 31 件目以降を削除（未読/既読を問わず常に最大 PRUNE_KEEP 件だけ保持）
      Notification.where(user_id: user.id)
                  .order(created_at: :desc)
                  .offset(PRUNE_KEEP)
                  .delete_all
    rescue => e
      Rails.logger.error("Notification prune failed: #{e.class}: #{e.message}")
    end

    # =========================
    # 共通 WebPush 本体（既存仕様維持）
    # =========================
    def send_web_push(user, title:, body:)
      return unless user.push_enabled? && user.push_subscription.present?
      Rails.logger.info("Push通知送信開始 user_id=#{user.id} endpoint=#{user.push_subscription.endpoint}")

      WebPush.payload_send(
        endpoint: user.push_subscription.endpoint,
        message: JSON.generate({ title: title, body: body }),
        p256dh:  user.push_subscription.key_p256dh,
        auth:    user.push_subscription.key_auth,
        vapid: {
          subject:     "mailto:admin@moriappli-emotion.com",
          public_key:  ENV["VAPID_PUBLIC_KEY"],
          private_key: ENV["VAPID_PRIVATE_KEY"]
        }
      )
      Rails.logger.info("✅ Push通知送信成功 user_id=#{user.id}")
    rescue => e
      Rails.logger.warn("❌ Push通知失敗 user_id=#{user.id}: #{e.class} - #{e.message}")
    end
  end
end
