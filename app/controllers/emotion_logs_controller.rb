# app/controllers/emotion_logs_controller.rb
class EmotionLogsController < ApplicationController
  before_action :authenticate_user!, except: %i[index show]

  ### ----  public アクション  ---- ###

def index
   Rails.logger.error "★ index: FLASH notice = #{flash[:notice].inspect}, session = #{session.id}"
  sleep 2  # わざと遅延させて、F12の「Network」でアクセス回数を確認
  @emotion_logs = EmotionLog
    .includes(:user, :bookmarks, :tags)  # ここを修正
    .order(date: :desc)

  @emotion_logs = @emotion_logs.where(emotion: params[:emotion]) if params[:emotion].present?
  @emotion_logs = @emotion_logs.joins(:tags).where(tags: { name: params[:genre] }) if params[:genre].present?
  @emotion_logs = @emotion_logs.page(params[:page]).per(7)

  @user_bookmark_ids = current_user.bookmarks.pluck(:emotion_log_id) if user_signed_in?
end

def my_emotion_logs
  @emotion_logs = current_user.emotion_logs
    .includes(:user, :bookmarks, :tags)  # ここも修正
    .order(date: :desc)
    .page(params[:page]).per(7)
  render :index
end






  def new
    @emotion_log = EmotionLog.new(music_url: params[:music_url],
                                  track_name: params[:track_name])

    respond_to do |format|
      format.turbo_stream
      format.html
    end
  end

  def create
    @emotion_log   = current_user.emotion_logs.build(emotion_log_params)
    hp_percentage  = calculate_hp(@emotion_log.emotion)

    if @emotion_log.save
      render json: { success: true,
                     message: '記録が保存されました',
                     redirect_url: emotion_logs_path,
                     hpPercentage: hp_percentage }
    else
      render json: { success: false,
                     errors:  @emotion_log.errors.full_messages },
             status: :unprocessable_entity
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
      render json: { success: true,
                    message: '記録が更新されました',
                    redirect_url: emotion_logs_path,
                    hpPercentage: hp_percentage }
    else
      render json: { success: false,
                    errors:  @emotion_log.errors.full_messages },
            status: :unprocessable_entity
    end
  end


def show
  @emotion_log = EmotionLog.find(params[:id])

  # コメント本体（ユーザーはincludesで先読み）
  @comments = Comment
                .where(emotion_log_id: @emotion_log.id)
                .includes(:user, :comment_reactions)
                .order(created_at: :desc)

  # 各コメントのリアクション数をまとめて取得
  # -> { [comment_id, kind] => count }
  @reaction_counts = CommentReaction
                       .where(comment_id: @comments.map(&:id))
                       .group(:comment_id, :kind)
                       .count

  # ログインユーザーがどのコメントにどのkindでリアクション済みかマップ
  # -> { comment_id => kind.to_s }
  @user_reactions = current_user&.comment_reactions
                              &.where(comment_id: @comments.map(&:id))
                              &.pluck(:comment_id, :kind)
                              &.to_h || {}
end



  # ---------- Turbo modal 用 ----------
  def form
    @emotion_log = EmotionLog.new(music_url: params[:music_url],
                                  track_name: params[:track_name])

    respond_to do |format|
      format.turbo_stream { render turbo_stream: turbo_stream.replace('modal-content',
                                                                      partial: 'emotion_logs/form',
                                                                      locals: { emotion_log: @emotion_log }) }
      format.html { redirect_to emotion_logs_path }
    end
  end

  def form_switch
    @emotion_log = EmotionLog.new(form_switch_params)
    respond_to { |format| format.turbo_stream }
  end

  # ----------  ここが今回の核心  ----------
  def destroy
    log      = EmotionLog.find(params[:id])
    dom_key  = view_context.dom_id(log)
    log.destroy

    render turbo_stream: turbo_stream.remove(dom_key)
  end
  # ------------------------------------

  def bookmarks
    @emotion_logs = current_user.bookmark_emotion_logs
                                .order(date: :desc)
                                .page(params[:page]).per(7)
  end

  ### ----  private 以下  ---- ###
  private

  # フォーム用パラメータ
  def form_switch_params
    params.permit(:track_name, :music_url)
  end

  # strong‑parameters
  def emotion_log_params
    params.require(:emotion_log)
          .permit(:date, :emotion, :description, :music_url, :track_name, :tag_names)
  end

  # HP 計算
  def calculate_hp(emotion)
    case emotion
    when 'めちゃくちゃ気分良い' then 50
    when '気分良い'              then 30
    when 'いつも通り'            then 0
    when 'イライラ'              then -30
    when '限界'                  then -50
    else 0
    end
  end

  # SoundCloud 連携チェック（必要なら有効化）
  def ensure_soundcloud_connected
    …
  end
end
