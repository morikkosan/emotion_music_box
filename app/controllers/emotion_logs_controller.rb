# app/controllers/emotion_logs_controller.rb
class EmotionLogsController < ApplicationController 
  # ▼▼ show も例外化（index/show は未ログインOK。show は下の ensure_logged_in_for_show が処理）
  before_action :authenticate_user!, except: %i[index show]
  before_action :ensure_owner, only: %i[edit update destroy]
  # ▼▼ 未ログインで show に来たら SoundCloud 認可へ飛ばす
  before_action :ensure_logged_in_for_show, only: %i[show]

  # =========================
  # 一覧
  # =========================
  def index
    Rails.logger.info "📱 UA: #{request.user_agent}"
    Rails.logger.info "📱 Mobile? #{mobile_device?}"
    Rails.logger.info "📢 flash(n): #{flash[:notice]} / (a): #{flash[:alert]}"

    @emotion_logs = EmotionLog.left_joins(:user, :bookmarks, :tags)

    # 感情フィルタ（hp指定が来たらhp→emotionに変換）
    if params[:emotion].present?
      @emotion_logs = @emotion_logs.where(emotion: params[:emotion])
    elsif params[:hp].present?
      hp_emotion = calculate_hp_emotion(params[:hp].to_i)
      @emotion_logs = @emotion_logs.where(emotion: hp_emotion) if hp_emotion.present?
    end

    # タグ（ジャンル）フィルタ
    if params[:genre].present?
      @emotion_logs = @emotion_logs.joins(:tags).where(tags: { name: params[:genre] })
    end

    # 並び替え・期間 + 重複排除 + ページング（index は従来通り new をデフォルト）
    @emotion_logs = apply_sort_and_period_filters(@emotion_logs, default_sort: "new")
                      .distinct
                      .page(params[:page]).per(7)

    # ユーザーのブクマID
    @user_bookmark_ids = user_signed_in? ? current_user.bookmarks.pluck(:emotion_log_id) : []

    # ---- ここが肝：モバイルのフレーム置換に対応 ----
    return if render_mobile_frame_if_needed

    render choose_view
  end

  # =========================
  # マイページ一覧
  # =========================
  def my_emotion_logs
    logs = current_user.emotion_logs.includes(:user, :bookmarks, :tags)
    logs = logs.where(emotion: params[:emotion]) if params[:emotion].present?
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?

    @emotion_logs = apply_sort_and_period_filters(logs, default_sort: "new")
                      .distinct
                      .page(params[:page]).per(7)

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @mypage_title = "👮マイページ👮"

    return if render_mobile_frame_if_needed

    render choose_view
  end

  # =========================
  # 詳細
  # =========================
  def show
    @emotion_log = EmotionLog.find_by(id: params[:id])
    unless @emotion_log
      respond_to do |format|
        format.html { redirect_to emotion_logs_path(view: params[:view]), alert: "この投稿は削除されています。" }
        format.turbo_stream do
          render turbo_stream: turbo_stream.redirect_to(
            emotion_logs_path(view: params[:view])
          ), status: :see_other
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

    # ★ モバイルからのフレーム遷移なら、必ず logs_list_mobile を返す
    if turbo_frame_request? && params[:view] == "mobile"
      render partial: "emotion_logs/show_mobile_frame", formats: [:html]
      return
    end

    respond_to do |format|
      format.html
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
    is_today       = @emotion_log.date&.to_date == Date.current   # ← nil安全化

    if @emotion_log.save
      Rails.logger.info("🔔 notify hp_delta=#{hp_delta} emotion=#{@emotion_log.emotion} hp_percentage=#{hp_percentage}")

      PushNotifier.send_emotion_log(
        current_user,
        emotion:     @emotion_log.emotion,
        track_name:  @emotion_log.track_name,
        artist_name: @emotion_log.description.presence || "アーティスト不明",
        hp:          hp_delta  # ← 差分固定
      )

      respond_to do |format|
        format.json do
          render json: {
            success:      true,
            message:      "記録が保存されました",
            redirect_url: emotion_logs_path,
            hpPercentage: hp_percentage,  # 0..100（メーター用）
            hpDelta:      hp_delta,       # ±（差分）
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
    @emotion_log = EmotionLog.find(params[:id])
    @emotion_log.tag_names = @emotion_log.tags.pluck(:name).join(",")
  end

  def update
    @emotion_log = EmotionLog.find(params[:id])
    attrs = emotion_log_params.to_h
    attrs.delete("hp")

    if @emotion_log.update(attrs)
      hp_from_form  = params.dig(:emotion_log, :hp).presence || params[:hp].presence
      hp_percentage = hp_from_form.present? ? hp_from_form.to_i.clamp(0, 100) : calculate_hp_percentage(@emotion_log.emotion)
      hp_delta      = calculate_hp(@emotion_log.emotion)
      is_today      = @emotion_log.date&.to_date == Date.current   # ← nil安全化

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
    log     = EmotionLog.find(params[:id])
    base_id = view_context.dom_id(log) # 例: "emotion_log_19840"

    log.destroy!  # CASCADE / dependent が効くので関連も削除

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
    logs = logs.where(emotion: params[:emotion]) if params[:emotion].present?
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?

    if ActiveModel::Type::Boolean.new.cast(params[:include_my_logs])
      my = current_user.emotion_logs.includes(:user, :tags)
      my = my.where(emotion: params[:emotion]) if params[:emotion].present?
      my = my.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?
      logs = EmotionLog.where(id: (logs.pluck(:id) + my.pluck(:id)).uniq).includes(:user, :tags)
    end

    # ★ デフォルトを「ブクマ数順（likes）」へ変更
    @emotion_logs = apply_sort_and_period_filters(logs, default_sort: "likes")
                      .distinct
                      .page(params[:page]).per(7)

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
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
    # ★ 直近の自分の投稿から感情を決定（なければ hp → fallback）
    last_emotion = current_user.emotion_logs.order(created_at: :desc).limit(1).pluck(:emotion).first
    if last_emotion.present?
      emotion = last_emotion
    else
      hp_val  = params[:hp].to_i.clamp(0, 100)
      emotion = calculate_hp_emotion(hp_val).presence || "いつも通り"
    end

    logs = EmotionLog.includes(:user, :bookmarks, :tags).where(emotion: emotion)
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?

    # ★ デフォルトを「ブクマ数順（likes）」へ
    @emotion_logs = apply_sort_and_period_filters(logs, default_sort: "likes")
                      .distinct
                      .page(params[:page]).per(7)

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

  # ★ 感情 → HP（0..100）へ変換（バーと一致：限界=0）
  def calculate_hp_percentage(emotion)
    case emotion
    when "限界"       then 0
    when "イライラ"   then 30
    when "いつも通り" then 50
    when "気分良い"   then 70
    when "最高"       then 100
    else 50
    end
  end

  # 0..100 → 感情
  def calculate_hp_emotion(hp)
    case hp
    when 0..1    then "限界"
    when 2..25   then "イライラ"
    when 26..50  then "いつも通り"
    when 51..70  then "気分良い"
    when 71..100 then "最高"
    else "いつも通り"
    end
  end

  # HPの差分（お好みのまま）
  def calculate_hp(emotion)
    { "最高" => 50, "気分良い" => 30, "いつも通り" => 0, "イライラ" => -30, "限界" => -50 }[emotion] || 0
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

  # ▼▼ default_sort を受け取れるように変更
  def apply_sort_and_period_filters(logs, default_sort: "new")
    sort_param = params[:sort].presence || default_sort
    logs = case sort_param
           when "new"      then logs.newest
           when "old"      then logs.oldest
           when "likes"    then logs.by_bookmarks
           when "comments" then logs.by_comments
           else logs
           end

    case params[:period]
    when "today"    then logs.for_today
    when "week"     then logs.for_week
    when "month"    then logs.for_month
    when "halfyear" then logs.for_half_year
    when "year"     then logs.for_year
    else logs
    end
  end

  # Strong Params（hp は読み取り用途で permit するが、保存には使わない）
  def emotion_log_params
    params.require(:emotion_log).permit(:date, :emotion, :description, :music_url, :track_name, :tag_names, :hp)
  end

  def form_switch_params
    params.permit(:track_name, :music_url)
  end

  def ensure_owner
    @emotion_log = EmotionLog.find(params[:id])
    head :forbidden unless @emotion_log.user == current_user
  end

  # ▼▼ 未ログインの show アクセスを SoundCloud 認可へ転送（ログイン後は index 固定）
  def ensure_logged_in_for_show
    return if user_signed_in?

    if turbo_frame_request? || request.format.turbo_stream?
      render turbo_stream: turbo_stream.redirect_to(user_soundcloud_omniauth_authorize_path), status: :see_other
    else
      redirect_to user_soundcloud_omniauth_authorize_path, status: :see_other
    end
  end
end
