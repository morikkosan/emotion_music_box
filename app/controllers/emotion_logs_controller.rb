# frozen_string_literal: true

class EmotionLogsController < ApplicationController
  include Paginatable

  # ▼ index/show は未ログインOK（showは ensure_logged_in_for_show が処理）
  before_action :authenticate_user!, except: %i[index show]
  # show は未ログインで @emotion_log をセットしない（テスト維持のため）
  before_action :set_emotion_log, only: %i[edit update destroy]
  before_action :ensure_owner,    only: %i[edit update destroy]
  before_action :ensure_logged_in_for_show, only: %i[show]

  # =========================
  # 一覧
  # =========================
  def index
    Rails.logger.info "📱 UA: #{request.user_agent}"
    Rails.logger.info "📱 Mobile? #{mobile_device?}"
    Rails.logger.info "📢 flash(n): #{flash[:notice]} / (a): #{flash[:alert]}"

    scope = EmotionLog.left_joins(:user, :bookmarks, :tags)
    scope = apply_filters(scope)

    base = apply_sort_and_period_filters(scope, default_sort: "new").distinct
    @emotion_logs = paginate_with_total_fix(base, per: 7)

    @user_bookmark_ids = user_signed_in? ? current_user.bookmarks.pluck(:emotion_log_id) : []

    return if render_mobile_frame_if_needed

    render choose_view
  end

  # =========================
  # マイページ一覧
  # =========================
  def my_emotion_logs
    logs = current_user.emotion_logs.includes(:user, :bookmarks, :tags)
    logs = apply_filters(logs)

    base = apply_sort_and_period_filters(logs, default_sort: "new").distinct
    @emotion_logs = paginate_with_total_fix(base, per: 7)

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @mypage_title = "👮マイページ👮"

    return if render_mobile_frame_if_needed

    render choose_view
  end

  # =========================
  # 詳細
  # =========================
  # =========================
# 詳細
# =========================
def show
  @emotion_log = EmotionLog.find_by(id: params[:id])
  unless @emotion_log
    respond_to do |format|
      format.html { redirect_to emotion_logs_path(view: params[:view]), alert: "この投稿は削除されています。" }
      format.turbo_stream do
        render turbo_stream: turbo_stream.redirect_to(emotion_logs_path(view: params[:view])), status: :see_other
      end
    end
    return
  end

  @comments = Comment.where(emotion_log_id: @emotion_log.id)
                     .includes(:user, :comment_reactions)
                     .order(created_at: :desc)
                     .page(params[:page]).per(10)

  @reaction_counts = CommentReaction.where(comment_id: @comments.map(&:id)).group(:comment_id, :kind).count
  @user_reactions  = current_user&.comment_reactions&.where(comment_id: @comments.map(&:id))&.pluck(:comment_id, :kind)&.to_h || {}

  # ===== ここで OGP/Twitter 用メタを作る =====
  # 例: 「イライラ | JK - CODE80」
  composed_title =
    [@emotion_log.emotion.presence, @emotion_log.track_name.presence].compact.join(" | ").presence ||
    "Emotion Music Box（エモム）"

  @meta = {
    title:        composed_title,
    description:  "感情と音楽をシェアする新感覚アプリ",
    url:          request.original_url,                 # 例: https://moriappli-emotion.com/emotion_logs/135
    image_png:    view_context.asset_url("ogp.png"),
    image_webp:   view_context.asset_url("ogp.webp"),
    image_alt:    "Emotion Music Box OGP"
  }
  # ===========================================

   # ★★★ デバッグ用ヘッダ（ここに配置：respond_to 前）★★★
  response.set_header("X-Emomu-ReqURL", request.original_url.to_s)
  response.set_header("X-Emomu-CanURL", view_context.canonical_url.to_s)
  response.set_header("X-Emomu-OGMetaBy", "@meta?=#{@meta.present?}")  # true ならレイアウトで @meta 優先


  if turbo_frame_request? && params[:view] == "mobile"
    render partial: "emotion_logs/show_mobile_frame", formats: [:html]
    return
  end

  respond_to do |format|
    format.html
    # 万一 /:id を Turbo で踏まれた場合は HTML に正規化
    format.turbo_stream { render turbo_stream: turbo_stream.redirect_to(emotion_log_path(@emotion_log, format: :html)) }
  end

  
end

  # =========================
  # 新規作成フォーム
  # =========================
  def new
    @emotion_log = EmotionLog.new(music_url: params[:music_url], track_name: params[:track_name])

    respond_to do |format|
      format.turbo_stream
      format.html
    end
  end

  # =========================
  # 作成
  # =========================
  def create
    attrs = emotion_log_params.to_h
    attrs.delete("hp")
    @emotion_log = current_user.emotion_logs.build(attrs)

    hp_from_form   = params.dig(:emotion_log, :hp).presence || params[:hp].presence
    hp_percentage  = hp_from_form.present? ? hp_from_form.to_i.clamp(0, 100) : calculate_hp_percentage(@emotion_log.emotion)
    hp_delta       = calculate_hp(@emotion_log.emotion)
    is_today       = @emotion_log.date&.to_date == Date.current

    if @emotion_log.save
      Rails.logger.info("🔔 notify hp_delta=#{hp_delta} emotion=#{@emotion_log.emotion} hp_percentage=#{hp_percentage}")

      # ★ show直行URLを作るために emotion_log を渡す
      PushNotifier.send_emotion_log(
        current_user,
        emotion:     @emotion_log.emotion,
        track_name:  @emotion_log.track_name,
        artist_name: @emotion_log.description.presence || "アーティスト不明",
        hp:          hp_delta,
        emotion_log: @emotion_log   # ← 必須！
      )

      respond_to do |format|
        format.json do
          render json: {
            success:      true,
            message:      "記録が保存されました",
            redirect_url: emotion_logs_path,
            hpPercentage: hp_percentage,
            hpDelta:      hp_delta,
            hp_today:     is_today
          }
        end
        format.turbo_stream do
          flash.now[:notice] = "記録が保存されました"
          render turbo_stream: [
            turbo_stream.replace(
              "flash-container",
              partial: "shared/flash",
              locals: { notice: flash.now[:notice], alert: flash.now[:alert] }
            ),
            turbo_stream.redirect_to(emotion_logs_path)
          ]
        end
        format.html { redirect_to emotion_logs_path, notice: "記録が保存されました" }
      end
    else
      respond_to do |format|
        format.json { render json: { success: false, errors: @emotion_log.errors.full_messages }, status: :unprocessable_entity }
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace(
            "record-modal-content",
            partial: "emotion_logs/form",
            locals: { emotion_log: @emotion_log }
          ), status: :unprocessable_entity
        end
        format.html do
          flash.now[:alert] = @emotion_log.errors.full_messages.join(", ")
          render :new, status: :unprocessable_entity
        end
      end
    end
  end

  # =========================
  # 編集/更新/削除
  # =========================
  def edit
    @emotion_log.tag_names = @emotion_log.tags.pluck(:name).join(",")
  end

  def update
    attrs = emotion_log_params.to_h
    attrs.delete("hp")

    if @emotion_log.update(attrs)
      hp_from_form  = params.dig(:emotion_log, :hp).presence || params[:hp].presence
      hp_percentage = hp_from_form.present? ? hp_from_form.to_i.clamp(0, 100) : calculate_hp_percentage(@emotion_log.emotion)
      hp_delta      = calculate_hp(@emotion_log.emotion)
      is_today      = @emotion_log.date&.to_date == Date.current

      render json: {
        success: true,
        message: "記録が更新されました",
        redirect_url: emotion_logs_path,
        hpPercentage: hp_percentage,
        hpDelta:      hp_delta,
        hp_today:     is_today
      }
    else
      render json: { success: false, errors: @emotion_log.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    base_id = view_context.dom_id(@emotion_log) # 例: "emotion_log_19840"

    @emotion_log.destroy!  # CASCADE / dependent が効く

    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          turbo_stream.remove(base_id),               # デスクトップ
          turbo_stream.remove("#{base_id}_mobile"),   # モバイル
          turbo_stream.append(
            "modal-container",
            view_context.tag.div(
              "",
              id: "flash-container",
              data: { flash_notice: "投稿を削除しました", flash_alert: nil }
            )
          )
        ]
      end
      format.html { redirect_to emotion_logs_path, notice: "投稿を削除しました" }
    end
  rescue ActiveRecord::InvalidForeignKey => e
    Rails.logger.error("❌ FK violation on destroy: #{e.class}: #{e.message}")
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.append(
          "modal-container",
          view_context.tag.div(
            "",
            id: "flash-container",
            data: { flash_notice: nil, flash_alert: "この投稿は関連づけが残っているため削除できませんでした。" }
          )
        ), status: :unprocessable_entity
      end
      format.html { redirect_to emotion_logs_path, alert: "関連づけが残っているため削除できませんでした。" }
    end
  end

  # =========================
  # その他補助
  # =========================
  def form
    @emotion_log = EmotionLog.new(music_url: params[:music_url], track_name: params[:track_name])

    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.update(
          "record-modal-content",
          partial: "emotion_logs/form",
          locals: { emotion_log: @emotion_log }
        )
      end
      format.html { redirect_to emotion_logs_path }
    end
  end

  def form_switch
    @emotion_log = EmotionLog.new(form_switch_params)
    respond_to { |format| format.turbo_stream }
  end

  def bookmarks
    Rails.logger.error("PARAMS: #{params.inspect}")

    logs = current_user.bookmarked_emotion_logs.includes(:user, :tags)
    logs = apply_filters(logs)

    if ActiveModel::Type::Boolean.new.cast(params[:include_my_logs])
      my = current_user.emotion_logs.includes(:user, :tags)
      my = apply_filters(my)
      logs = EmotionLog.where(id: (logs.pluck(:id) + my.pluck(:id)).uniq).includes(:user, :tags)
    end

    base = apply_sort_and_period_filters(logs, default_sort: "likes").distinct
    @emotion_logs = paginate_with_total_fix(base, per: 7)

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @user_bookmark_ids |= current_user.emotion_logs.pluck(:id) if ActiveModel::Type::Boolean.new.cast(params[:include_my_logs])

    @bookmark_page = "♡お気に入りリスト♡"

    if @emotion_logs.blank?
      redirect_to emotion_logs_path(view: params[:view]), alert: "まだお気に入り投稿がありません。"
      return
    end

    if turbo_frame_request? && request.headers["Turbo-Frame"] == "logs_list_mobile"
      render partial: "emotion_logs/logs_list_mobile_frame"
      return
    end

    return if render_mobile_frame_if_needed
    render choose_view
  end

  def recommended
    # 直近の自分の投稿から感情を決定（なければ hp → fallback）
    last_emotion = current_user.emotion_logs.order(created_at: :desc).limit(1).pluck(:emotion).first
    emotion = if last_emotion.present?
                last_emotion
              else
                hp_val  = params[:hp].to_i.clamp(0, 100)
                calculate_hp_emotion(hp_val).presence || "いつも通り"
              end

    logs = EmotionLog.includes(:user, :bookmarks, :tags).where(emotion: emotion)
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?

    base = apply_sort_and_period_filters(logs, default_sort: "likes").distinct
    @emotion_logs = paginate_with_total_fix(base, per: 7)

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @recommended_page  = "🔥おすすめ🔥"

    return if render_mobile_frame_if_needed
    render choose_view
  end

  def playlist_sidebar_modal
    @playlists = current_user.playlists.includes(:playlist_items, :emotion_logs)
    render partial: "emotion_logs/playlist_sidebar", locals: { playlists: @playlists }, formats: [:html]
  end

  private

  # ===== DRY: 絞り込み共通化（振る舞いは従来と同じ） =====
  def apply_filters(scope)
    if params[:emotion].present?
      scope = scope.where(emotion: params[:emotion])
    elsif params[:hp].present?
      hp_emotion = calculate_hp_emotion(params[:hp].to_i)
      scope = scope.where(emotion: hp_emotion) if hp_emotion.present?
    end

    if params[:genre].present?
      scope = scope.joins(:tags).where(tags: { name: params[:genre] })
    end

    scope
  end

  # ▼▼ HP計算（ラッパーは残す：既存RSpecがそのまま通る）
  def calculate_hp_percentage(emotion)
    HpCalculator.percentage(emotion)
  end

  def calculate_hp_emotion(hp)
    HpCalculator.from_hp(hp)
  end

  def calculate_hp(emotion)
    HpCalculator.delta(emotion)
  end

  def render_mobile_frame_if_needed
    if turbo_frame_request? && params[:view] == "mobile"
      render partial: "emotion_logs/logs_list_mobile_frame", formats: [:html]
      return true
    end
    false
  end

  def choose_view
    (params[:view] == "mobile" || mobile_device?) ? :mobile_index : :index
  end

  def mobile_device?
    request.user_agent.to_s.downcase =~ /mobile|webos|iphone|android/
  end

  # ▼▼ default_sort を受け取れるラッパー（RSpec互換を維持）
  def apply_sort_and_period_filters(logs, default_sort: "new")
    EmotionLogQuery.new(logs, params, default_sort: default_sort).call
  end

  # Strong Params（hp は読み取り用途で permit するが、保存には使わない）
  def emotion_log_params
    params.require(:emotion_log).permit(:date, :emotion, :description, :music_url, :track_name, :tag_names, :hp)
  end

  def form_switch_params
    params.permit(:track_name, :music_url)
  end

  def set_emotion_log
    @emotion_log = EmotionLog.find(params[:id])
  end

  def ensure_owner
    head :forbidden unless @emotion_log.user_id == current_user&.id
  end

  # ▼▼ 未ログインの show アクセス制御（ボット例外＋可視化ヘッダ）
  #    ① ログイン済: そのまま
  #    ② ボット（または ?_as_bot=1 / true / 空でも key があればOK）: そのまま通す（OGP取得用）
  #    ③ 上記以外: 認可フローへ 303
  def ensure_logged_in_for_show
    as_bot = bot_crawler_request?

    # 可視化：curl -I で見えるようにヘッダ出力
    response.set_header("X-Emomu-BotCheck", as_bot ? "true" : "false")
    response.set_header("X-Emomu-UA", request.user_agent.to_s[0, 160]) # 長過ぎ防止
    response.set_header("X-Emomu-AsBotParam", params[:_as_bot].to_s)

    Rails.logger.info("[OGP_BOT] ua=#{request.user_agent.inspect} as_bot=#{as_bot} _as_bot=#{params[:_as_bot].inspect}")

    return if user_signed_in? || as_bot

    if turbo_frame_request? || request.format.turbo_stream?
      render turbo_stream: turbo_stream.redirect_to(user_soundcloud_omniauth_authorize_path), status: :see_other
    else
      redirect_to user_soundcloud_omniauth_authorize_path, status: :see_other
    end
  end

  # ★主要クローラ簡易判定
  # - UA は downcase で包含判定
  # - 手元検証用に ?_as_bot を “存在すれば真” とみなす（1/true/空 いずれでもOK）
  # - params.key? 対応で取りこぼし防止（symbol/string 両方）
  def bot_crawler_request?
    # 1) クエリスイッチ（存在すれば真）
    return true if params[:_as_bot].present?
    return true if params.key?(:_as_bot) || params.key?("_as_bot")

    # 2) UA で機械判定
    ua = request.user_agent.to_s.downcase

    # 代表的プレビューBot
    return true if ua.include?("twitterbot")
    return true if ua.include?("facebookexternalhit") || ua.include?("facebot")
    return true if ua.include?("slackbot")
    # "line" は汎用語なので誤検出を避けるために一部限定（スペース/ハイフン/ボット語尾も見る）
    return true if ua.include?("line-poker") || ua.include?("linebot") || ua.include?(" line/") || ua.include?(" line ")
    return true if ua.include?("linkedinbot")
    return true if ua.include?("discordbot")
    return true if ua.include?("telegrambot")

    # OGP/構造化データ系
    return true if ua.include?("google-structured-data")
    return true if ua.include?("googlebot")

    false
  end
end
