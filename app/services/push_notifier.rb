# frozen_string_literal: true

require "web_push"

class PushNotifier
  # 新しい順に30件だけ残す
  PRUNE_KEEP = 30
  INDEX_PATH = "/emotion_logs"

  class << self
    # =========================
    # ドメイン固有の送信エントリ
    # =========================

    # 感情ログ投稿の通知（★ show 直行URLを保存）
    #
    # - emotion_log はオブジェクトでも id でもOK（どちらか必須）
    def send_emotion_log(user, emotion:, track_name:, artist_name:, hp:, emotion_log:)
      id = extract_id(emotion_log)
      delta = hp.to_i
      sign  = delta >= 0 ? "+#{delta}" : delta.to_s
      title = "🎵 新しい投稿通知"
      body  = "#{emotion}な気分で『#{track_name} / #{artist_name}』を投稿しました！(HP: #{sign})"

      # ★ URL を show に固定（id が無ければ一覧にフォールバック）
      url = id ? "/emotion_logs/#{id}" : INDEX_PATH

      # ★ kind は既存の enum/validation に合わせて "generic" を使用
      create_notification!(
        user,
        kind:  "generic",
        title: title,
        body:  body,
        url:   url
      )

      # ★Push送信（従来どおり）
      send_web_push(user, title: title, body: body)
    end

    # コメント通知（必要なら emotion_log_id を渡せるよう拡張）
    # 例: send_comment_notification(user, commenter_name: "A", comment_body: "...", emotion_log: log)
    def send_comment_notification(user, commenter_name:, comment_body:, emotion_log: nil)
      id    = extract_id(emotion_log)
      title = "💬 新しいコメント"
      body  = "#{commenter_name}さんがあなたの投稿にコメントしました:「#{comment_body.to_s.truncate(20)}」"
      url   = id ? "/emotion_logs/#{id}" : INDEX_PATH

      create_notification!(
        user,
        kind:  "comment",
        title: title,
        body:  body,
        url:   url
      )

      send_web_push(user, title: title, body: body)
    end

    # ブックマーク通知（必要なら emotion_log_id を渡せるよう拡張）
    def send_bookmark_notification(user, by_user_name:, track_name:, emotion_log: nil)
      id    = extract_id(emotion_log)
      title = "⭐ ブックマークされました"
      body  = "#{by_user_name}さんが「#{track_name}」をブックマークしました"
      url   = id ? "/emotion_logs/#{id}" : INDEX_PATH

      create_notification!(
        user,
        kind:  "bookmark",
        title: title,
        body:  body,
        url:   url
      )

      send_web_push(user, title: title, body: body)
    end

    # コメントへのリアクション通知（必要なら emotion_log_id を渡せるよう拡張）
    def send_reaction_notification(user, reactor_name:, comment_body:, reaction_kind:, emotion_log: nil)
      id    = extract_id(emotion_log)
      title = "✨ リアクションが届きました"
      body  = "#{reactor_name}さんがあなたのコメント「#{comment_body.to_s.truncate(20)}」に#{reaction_kind}しました"
      url   = id ? "/emotion_logs/#{id}" : INDEX_PATH

      create_notification!(
        user,
        kind:  "reaction",
        title: title,
        body:  body,
        url:   url
      )

      send_web_push(user, title: title, body: body)
    end

    # =========================
    # 共通WebPush本体（既存どおり）
    # =========================
    def send_web_push(user, title:, body:)
      return unless user.push_enabled? && user.push_subscription.present?

      WebPush.payload_send(
        endpoint: user.push_subscription.endpoint,
        message:  JSON.generate({ title: title, body: body }),
        p256dh:   user.push_subscription.key_p256dh,
        auth:     user.push_subscription.key_auth,
        vapid: {
          subject:    "mailto:admin@moriappli-emotion.com",
          public_key:  ENV["VAPID_PUBLIC_KEY"],
          private_key: ENV["VAPID_PRIVATE_KEY"]
        }
      )
    rescue => e
      Rails.logger.warn("❌ WebPush通知失敗 user_id=#{user.id}: #{e.class} - #{e.message}")
    end

    # =========================
    # DB保存＋古いの削除（30件キープ）
    # =========================
    def create_notification!(user, kind:, title:, body:, url:, read_at: nil)
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
    rescue ArgumentError => e
      # enum/validation で kind が不正な場合、"generic" にフォールバックして再試行
      if e.message.include?("is not a valid kind")
        Rails.logger.warn("⚠️ invalid kind='#{kind}'. fallback to 'generic'")
        Notification.transaction do
          Notification.create!(
            user_id: user.id,
            kind:    "generic",
            title:   title,
            body:    body,
            url:     url,
            read_at: read_at
          )
          prune_old_notifications!(user)
        end
      else
        raise
      end
    rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
      # ここで落としてPushを止めない（カウントだけ諦め、Pushは続行）
      Rails.logger.warn("⚠️ 通知レコード作成スキップ user_id=#{user.id}: #{e.class} - #{e.message}")
    end

    def prune_old_notifications!(user)
      ids = Notification.where(user_id: user.id)
                        .order(created_at: :desc)
                        .offset(PRUNE_KEEP)
                        .pluck(:id)
      Notification.where(id: ids).delete_all if ids.any?
    end

    # =========================
    # 小ユーティリティ
    # =========================
    # EmotionLog オブジェクト or id を許容して id を返す
    def extract_id(log_or_id)
      return nil if log_or_id.nil?
      return log_or_id.id if log_or_id.respond_to?(:id)
      return log_or_id.to_i if log_or_id.is_a?(String) || log_or_id.is_a?(Integer)
      nil
    end
  end
end
