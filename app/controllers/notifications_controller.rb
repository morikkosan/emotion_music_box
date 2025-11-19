# app/controllers/notifications_controller.rb
class NotificationsController < ApplicationController
  before_action :authenticate_user!
  before_action :ensure_test_endpoints_allowed!, only: [ :test, :debug_emotion ]
  before_action :set_notification, only: :read

  # =========================
  # 一覧：/notifications
  # 👉 開いた瞬間に全未読を既読化 → その状態で新着順表示
  # =========================
  def index
    # 1) 未読があれば一括既読化（1クエリで高速）
    unread_scope = current_user.notifications.where(read_at: nil)
    @just_marked_all_read = unread_scope.exists?
    unread_scope.update_all(read_at: Time.current) if @just_marked_all_read

    # 2) 既読反映後の一覧を新着順で取得
    @notifications = current_user.notifications.order(created_at: :desc)

    # ページングを使うなら：
    # @notifications = @notifications.page(params[:page])
  end

  # =========================
  # 未読件数（バッジ用）：/notifications/unread_count.json
  # =========================
  def unread_count
    count = current_user.notifications.where(read_at: nil).count
    render json: { unread_count: count }
  end

  # =========================
  # 個別既読：POST /notifications/:id/read
  # （今回の仕様では基本未使用。互換のため残置）
  # =========================
  def read
    unless @notification.read_at
      @notification.update!(read_at: Time.current)
    end
    head :ok
  end

  # =========================
  # 一括既読：POST /notifications/read_all
  # （indexで既読化するので基本未使用。API互換で残置）
  # =========================
  def read_all
    current_user.notifications.where(read_at: nil).update_all(read_at: Time.current)
    head :ok
  end

  # =========================
  # Pushトグル（デスクトップ向け）
  # =========================
  def enable
    current_user.update!(push_enabled: true)
    render_toggle
  end

  def disable
    current_user.update!(push_enabled: false)
    render_toggle
  end

  # =========================
  # VAPID 公開鍵：/notifications/public_key
  # =========================
  def public_key
    key = ENV["VAPID_PUBLIC_KEY"].to_s
    return head :no_content if key.blank?
    render json: { publicKey: key }
  end

  # =========================
  # デバッグ系（既存互換）
  # =========================
  def test
    user = find_target_user_for_test
    return render plain: "No subscription", status: :unprocessable_entity unless user&.push_subscription.present?

    if send_webpush(user, title: "通知テスト 🎉", body: "リアクション通知のテストです！", path: "/emotion_logs")
      render plain: "通知送信しました"
    else
      render plain: "通知送信に失敗しました", status: :internal_server_error
    end
  end

  def debug_emotion
    user = current_user
    unless user&.push_subscription.present?
      return redirect_back fallback_location: root_path, alert: "プッシュ購読がありません。まず通知をオンにしてください。"
    end

    if send_webpush(user, title: "通知テスト 🎉", body: "これはテスト通知です", path: "/emotion_logs")
      redirect_back fallback_location: root_path, notice: "通知テストを送信しました。"
    else
      redirect_back fallback_location: root_path, alert: "通知送信に失敗しました。"
    end
  end

  # POST /push/emotion（未使用なら routes ごと削除推奨）
  def send_emotion_log
    head :ok
  end

  # ==========================================================
  # ★ 追加：通知モーダル（外枠をTurbo Streamで差し込み → 自動で開く）
  #     /notifications/modal (GET, turbo_stream)
  # ==========================================================
  def modal
    respond_to do |format|
      format.turbo_stream
    end
  end

  # ==========================================================
  # ★ 追加：通知モーダルの1ページ分（10件／最新30件まで）
  #     /notifications/modal_page?page=1..3
  #   - 表示された10件のみ既読化
  #   - Turbo Frame（notifications-modal-frame）へ読み込まれる
  # ==========================================================
  def modal_page
  # 最新30件に制限（Kaminari利用）
  scope = current_user.notifications.order(created_at: :desc).limit(30)
  @notifications = scope.page(params[:page]).per(10)

  # 今回表示される10件のみ既読化
  ids = @notifications.map(&:id)
  if ids.present?
    current_user.notifications.where(id: ids, read_at: nil).update_all(read_at: Time.current)
  end

  # 総数（30以内）
  @total_count = scope.count

  # ★ここが重要：レイアウトを使わない（必ずビュー内の turbo-frame を返す）
  render :modal_page, layout: false
end


  private

  # ====== 共通ヘルパ ======
  def set_notification
    @notification = current_user.notifications.find(params[:id])
  end

  # Push ON/OFF 後に、デスクトップの Push トグル枠だけ更新
  def render_toggle
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          # 新：デスクトップ専用 Push トグル枠
          turbo_stream.replace(
            "notification-push-toggle-desktop",
            partial: "shared/notification_push_toggle",
            locals: { frame_id: "notification-push-toggle-desktop" }
          ),
          # 互換：旧IDが残っている環境向け（存在しなくてもOK）
          turbo_stream.replace(
            "notification-toggle-desktop",
            partial: "shared/notification_push_toggle",
            locals: { frame_id: "notification-toggle-desktop" }
          )
        ]
      end
      format.html { redirect_back fallback_location: root_path }
    end
  end

  def send_webpush(user, title:, body:, path:)
    sub = user.push_subscription
    return false unless sub && ENV["VAPID_PUBLIC_KEY"].present? && ENV["VAPID_PRIVATE_KEY"].present?

    WebPush.payload_send(
      endpoint: sub.endpoint,
      message: {
        title: title,
        options: { body: body, icon: "/icon.png", data: { path: path } }
      }.to_json,
      p256dh: sub.key_p256dh,
      auth:   sub.key_auth,
      vapid: {
        subject:    "mailto:you@example.com",
        public_key: ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      }
    )
    true
  rescue => e
    Rails.logger.error("WebPush failed: #{e.class}: #{e.message}")
    false
  end

  def ensure_test_endpoints_allowed!
    return if Rails.env.development? || Rails.env.test?
    if action_name == "test"
      head :forbidden unless params[:id].to_s == current_user.id.to_s
    end
  end

  def find_target_user_for_test
    if Rails.env.production?
      current_user
    else
      User.find_by(id: params[:id]) || current_user
    end
  end
end
