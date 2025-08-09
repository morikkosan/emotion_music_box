# app/controllers/emotion_logs_controller.rb
class EmotionLogsController < ApplicationController 
  before_action :authenticate_user!, except: %i[index show]
  before_action :ensure_owner, only: %i[edit update destroy]

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

    # 並び替え・期間 + 重複排除 + ページング
    @emotion_logs = apply_sort_and_period_filters(@emotion_logs)
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

    @emotion_logs = apply_sort_and_period_filters(logs)
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
    @emotion_log = EmotionLog.find(params[:id])
    @comments = Comment.where(emotion_log_id: @emotion_log.id)
                       .includes(:user, :comment_reactions)
                       .order(created_at: :desc)
                       .page(params[:page]).per(10)

    @reaction_counts = CommentReaction.where(comment_id: @comments.map(&:id)).group(:comment_id, :kind).count
    @user_reactions  = current_user&.comment_reactions&.where(comment_id: @comments.map(&:id))&.pluck(:comment_id, :kind)&.to_h || {}

    respond_to do |format|
      format.html
      format.turbo_stream
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
    @emotion_log  = current_user.emotion_logs.build(emotion_log_params)
    hp_percentage = calculate_hp(@emotion_log.emotion)
    is_today      = @emotion_log.date.to_date == Date.current

    if @emotion_log.save
      PushNotifier.send_emotion_log(
        current_user,
        emotion:     @emotion_log.emotion,
        track_name:  @emotion_log.track_name,
        artist_name: @emotion_log.description.presence || "アーティスト不明",
        hp:          hp_percentage
      )

      respond_to do |format|
        format.json do
          render json: {
            success:      true,
            message:      "記録が保存されました",
            redirect_url: emotion_logs_path,
            hpPercentage: hp_percentage,
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
        format.json  { render json: { success: false, errors: @emotion_log.errors.full_messages }, status: :unprocessable_entity }
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace(
            "form-container",
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

    if @emotion_log.update(emotion_log_params)
      hp_percentage = calculate_hp(@emotion_log.emotion)
      is_today      = @emotion_log.date.to_date == Date.current

      render json: {
        success: true,
        message: "記録が更新されました",
        redirect_url: emotion_logs_path,
        hpPercentage: hp_percentage,
        hp_today: is_today
      }
    else
      render json: { success: false, errors: @emotion_log.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    log = EmotionLog.find(params[:id])
    dom_key = view_context.dom_id(log)
    log.destroy

    render turbo_stream: turbo_stream.remove(dom_key) + turbo_stream.append(
      "modal-container",
      view_context.tag.div(
        "",
        id: "flash-container",
        data: { flash_notice: "投稿を削除しました", flash_alert: nil }
      )
    )
  end

  # =========================
  # その他補助
  # =========================
  def form
    @emotion_log = EmotionLog.new(music_url: params[:music_url], track_name: params[:track_name])

    respond_to do |format|
      format.turbo_stream { render turbo_stream: turbo_stream.replace("modal-content", partial: "emotion_logs/form", locals: { emotion_log: @emotion_log }) }
      format.html         { redirect_to emotion_logs_path }
    end
  end

  def form_switch
    @emotion_log = EmotionLog.new(form_switch_params)
    respond_to { |format| format.turbo_stream }
  end

  # =========================
  # ブックマーク一覧
  # =========================
  def bookmarks
    Rails.logger.error("PARAMS: #{params.inspect}")

    logs = current_user.bookmarked_emotion_logs.includes(:user, :tags)
    logs = logs.where(emotion: params[:emotion]) if params[:emotion].present?
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?

    # 自分の投稿もマージ
    if ActiveModel::Type::Boolean.new.cast(params[:include_my_logs])  # ← ここを修正
      my = current_user.emotion_logs.includes(:user, :tags)
      my = my.where(emotion: params[:emotion]) if params[:emotion].present?
      my = my.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?
      logs = EmotionLog.where(id: (logs.pluck(:id) + my.pluck(:id)).uniq).includes(:user, :tags)
    end

    @emotion_logs = apply_sort_and_period_filters(logs)
                      .distinct
                      .page(params[:page]).per(7)

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @bookmark_page = "♡お気に入りリスト♡"

    if @emotion_logs.blank?
      redirect_to emotion_logs_path(view: params[:view]), alert: "まだお気に入り投稿がありません。"
      return
    end

     if turbo_frame_request? && request.headers["Turbo-Frame"] == "logs_list_mobile"
    # ここは <%= turbo_frame_tag "logs_list_mobile" %> を含むパーシャルを返す
    render partial: "emotion_logs/logs_list_mobile_frame"
    return
  end

    # モバイルのフレーム置換対応
    return if render_mobile_frame_if_needed

    render choose_view
  end

  # =========================
  # おすすめ
  # =========================
  def recommended
    hp       = params[:hp].to_i.clamp(0, 100)
    emotion  = calculate_hp_emotion(hp)
    logs     = EmotionLog.includes(:user, :bookmarks, :tags).where(emotion: emotion)
    logs     = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?

    @emotion_logs = apply_sort_and_period_filters(logs)
                      .distinct
                      .page(params[:page]).per(7)

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @recommended_page  = "🔥おすすめ🔥"

    return if render_mobile_frame_if_needed

    render choose_view
  end

  # =========================
  # スマホのプレイリストモーダル
  # =========================
  def playlist_sidebar_modal
    @playlists = current_user.playlists.includes(:playlist_items, :emotion_logs)
    render partial: "emotion_logs/playlist_sidebar", locals: { playlists: @playlists }, formats: [:html]
  end

  private

  # ---- 共通: モバイルフレームだけ返す処理 ----
  def render_mobile_frame_if_needed
    if turbo_frame_request? && params[:view] == "mobile"
      render partial: "emotion_logs/logs_list_mobile_frame", formats: [:html]
      return true
    end
    false
  end

  # ---- 共通: ビュー選択 ----
  def choose_view
    (params[:view] == "mobile" || mobile_device?) ? :mobile_index : :index
  end

  def mobile_device?
    request.user_agent.to_s.downcase =~ /mobile|webos|iphone|android/
  end

  def calculate_hp_emotion(hp)
    case hp
    when 0..1   then "限界"
    when 2..25  then "イライラ"
    when 26..50 then "いつも通り"
    when 51..70 then "気分良い"
    when 71..100 then "最高"
    else "いつも通り"
    end
  end

  def apply_sort_and_period_filters(logs)
    sort_param = params[:sort].presence || "new"
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

  def emotion_log_params
    params.require(:emotion_log).permit(:date, :emotion, :description, :music_url, :track_name, :tag_names)
  end

  def form_switch_params
    params.permit(:track_name, :music_url)
  end

  def calculate_hp(emotion)
    { "最高" => 50, "気分良い" => 30, "いつも通り" => 0, "イライラ" => -30, "限界" => -50 }[emotion] || 0
  end

  def ensure_owner
    @emotion_log = EmotionLog.find(params[:id])
    head :forbidden unless @emotion_log.user == current_user
  end
end
