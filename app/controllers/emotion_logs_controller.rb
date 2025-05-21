class EmotionLogsController < ApplicationController
  before_action :authenticate_user!, except: %i[index show]
  before_action :ensure_owner, only: [:edit, :update, :destroy]

  def index
    Rails.logger.error "★ index: FLASH notice = #{flash[:notice].inspect}, session = #{session.id}"

    @emotion_logs = EmotionLog.includes(:user, :bookmarks, :tags)

    if params[:emotion].present?
      @emotion_logs = @emotion_logs.where(emotion: params[:emotion])
    elsif params[:hp].present?
      hp = params[:hp].to_i
      hp_emotion = case hp
                   when 0..1 then "限界"
                   when 2..25 then "イライラ"
                   when 26..50 then "いつも通り"
                   when 51..70 then "気分良い"
                   when 71..100 then "最高"
                   else nil
                   end
      @emotion_logs = @emotion_logs.where(emotion: hp_emotion) if hp_emotion.present?
    end

    @emotion_logs = @emotion_logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?

    @emotion_logs = apply_sort_and_period_filters(@emotion_logs)

    @emotion_logs = @emotion_logs.page(params[:page]).per(7)
    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id) if user_signed_in?
  end

  def my_emotion_logs
    logs = current_user.emotion_logs.includes(:user, :bookmarks, :tags)
    logs = logs.where(emotion: params[:emotion]) if params[:emotion].present?
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?
    @emotion_logs = apply_sort_and_period_filters(logs).page(params[:page]).per(7)
    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @mypage_title = "👮マイページ👮"
    render :index
  end

  def show
  @emotion_log = EmotionLog.find(params[:id])
  @comments = Comment.where(emotion_log_id: @emotion_log.id)
                  .includes(:user, :comment_reactions)
                  .order(created_at: :desc)
                  .page(params[:page])
                  .per(10)

  @reaction_counts = CommentReaction.where(comment_id: @comments.map(&:id)).group(:comment_id, :kind).count
  @user_reactions = current_user&.comment_reactions&.where(comment_id: @comments.map(&:id))&.pluck(:comment_id, :kind)&.to_h || {}

  respond_to do |format|
    format.html
    format.turbo_stream
  end
end


  def new
    @emotion_log = EmotionLog.new(music_url: params[:music_url], track_name: params[:track_name])
    respond_to do |format|
      format.turbo_stream
      format.html
    end
  end

  def create
    @emotion_log = current_user.emotion_logs.build(emotion_log_params)
    hp_percentage = calculate_hp(@emotion_log.emotion)
    Rails.logger.error "★ 受け取った emotion = #{@emotion_log.emotion}"
    Rails.logger.error "★ 計算した hp_percentage = #{hp_percentage}"

    if @emotion_log.save
      render json: { success: true, message: '記録が保存されました', redirect_url: emotion_logs_path, hpPercentage: hp_percentage }
    else
      render json: { success: false, errors: @emotion_log.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def edit
    @emotion_log = EmotionLog.find(params[:id])
    @emotion_log.tag_names = @emotion_log.tags.pluck(:name).join(",")
  end

  def update
    @emotion_log = EmotionLog.find(params[:id])

    if @emotion_log.update(emotion_log_params)
      hp_percentage = calculate_hp(@emotion_log.emotion)
      render json: { success: true, message: '記録が更新されました', redirect_url: emotion_logs_path, hpPercentage: hp_percentage }
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
    "",  # 中身は空でもOK
    id: "flash-container",
    data: {
      flash_notice: "投稿を削除しました",
      flash_alert:  nil
    }
  )
)
  end



  def form
    @emotion_log = EmotionLog.new(music_url: params[:music_url], track_name: params[:track_name])
    respond_to do |format|
      format.turbo_stream { render turbo_stream: turbo_stream.replace('modal-content', partial: 'emotion_logs/form', locals: { emotion_log: @emotion_log }) }
      format.html { redirect_to emotion_logs_path }
    end
  end

  def form_switch
    @emotion_log = EmotionLog.new(form_switch_params)
    respond_to { |format| format.turbo_stream }
  end

  def bookmarks
    logs = current_user.bookmarked_emotion_logs.includes(:user, :tags)
    logs = logs.where(emotion: params[:emotion]) if params[:emotion].present?
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?
    @emotion_logs = apply_sort_and_period_filters(logs).page(params[:page]).per(7)
    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @bookmark_page = "♡お気に入りリスト♡"
    render :index
  end

  def recommended
  hp = params[:hp].to_i.clamp(0, 100)
    emotion = case hp
              when 0..1 then "限界"
              when 2..25 then "イライラ"
              when 26..50 then "いつも通り"
              when 51..70 then "気分良い"
              when 71..100 then "最高"
              else "いつも通り"
              end

    logs = EmotionLog.includes(:user, :bookmarks, :tags).where(emotion: emotion)
    logs = logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?
    @emotion_logs = apply_sort_and_period_filters(logs).page(params[:page])

    @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id)
    @mypage_title = "おすすめ🔥（#{emotion}）"
    @recommended_page = "🔥おすすめ🔥"

    render :index
  end

  private

  def apply_sort_and_period_filters(logs)
  sort_param = params[:sort].presence || "new"

  logs = case sort_param
         when "new"      then logs.newest
         when "old"      then logs.oldest
         when "likes"    then logs.by_bookmarks
         when "comments" then logs.by_comments
         else logs
         end

  logs = case params[:period]
         when "today"    then logs.for_today
         when "week"     then logs.for_week
         when "month"    then logs.for_month
         when "halfyear" then logs.for_half_year
         when "year"     then logs.for_year
         else logs
         end

  logs
end


  def emotion_log_params
    params.require(:emotion_log).permit(:date, :emotion, :description, :music_url, :track_name, :tag_names)
  end

  def form_switch_params
    params.permit(:track_name, :music_url)
  end

  def calculate_hp(emotion)
    case emotion
    when '最高'     then 50
    when '気分良い' then 30
    when 'いつも通り' then 0
    when 'イライラ' then -30
    when '限界'     then -50
    else 0
    end
  end

  def ensure_owner
    @emotion_log = EmotionLog.find(params[:id])
    head :forbidden unless @emotion_log.user == current_user
  end

  def ensure_soundcloud_connected
    # 実装されていればここに記述
  end
end
