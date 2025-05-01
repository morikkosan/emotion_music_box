class EmotionLogsController < ApplicationController

  before_action :authenticate_user!, except: [:index, :show]
  # before_action :ensure_soundcloud_connected, only: [:index]

  def index
    @emotion_logs = EmotionLog.order(date: :desc)
                              .page(params[:page])
                              .per(7)
    # 感情ごとのデータを取得
    # @emotion_chart_data = EmotionLog.group(:emotion).count
  end

  def  my_emotion_logs
    @emotion_logs = current_user.emotion_logs.order(date: :desc)
                                              .page(params[:page])
                                              .per(7)
    render :index
  end

  def new
    @emotion_log = EmotionLog.new
    respond_to do |format|
      format.turbo_stream # ←これでnew.turbo_stream.erbを返す
      format.html
    end
  end

  def create
    @emotion_log = current_user.emotion_logs.build(emotion_log_params)
    hp_percentage = calculate_hp(@emotion_log.emotion) # HPの計算
  
    Rails.logger.info "🚀 感情: #{@emotion_log.emotion}, 計算されたHP: #{hp_percentage}"
  
    if @emotion_log.save
      render json: { 
        success: true, 
        message: "記録が保存されました", 
        redirect_url: emotion_logs_path, 
        hpPercentage: hp_percentage # HP値を追加
      }
    else
      Rails.logger.error "❌ 感情ログの保存に失敗: #{@emotion_log.errors.full_messages}"
      render json: { success: false, errors: @emotion_log.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def edit
    @emotion_log = EmotionLog.find(params[:id])
  end

  def update
      @emotion_log = EmotionLog.find(params[:id])
      if @emotion_log.update(emotion_log_params)
        hp_percentage = calculate_hp(@emotion_log.emotion) # HPの再計算
        Rails.logger.info "🚀 感情: #{@emotion_log.emotion}, 計算されたHP: #{hp_percentage}"
        render json: { 
          success: true, 
          message: "記録が更新されました", 
          redirect_url: emotion_logs_path, 
          hpPercentage: hp_percentage
        }
      else
        Rails.logger.error "❌ 感情ログの更新に失敗: #{@emotion_log.errors.full_messages}"
        render json: { success: false, errors: @emotion_log.errors.full_messages }, status: :unprocessable_entity
      end
    end

  def show
    @emotion_log = EmotionLog.find(params[:id])
  end

  # def chart_data
  #   emotions = ['めちゃくちゃ気分良い', '気分良い', 'いつも通り', 'イライラ', '限界']
  #   emotion_chart = EmotionLog.group(:emotion).count
  #   emotion_counts = emotions.map { |emotion| emotion_chart[emotion] || 0 }

  #   formatted_data = {
  #     labels: emotions,
  #     datasets: [{
  #       label: '感情ログ',
  #       data: emotion_counts,
  #       backgroundColor: [
  #         'rgb(245, 39, 169)', # めちゃくちゃ気分良い
  #         'rgb(223, 137, 62)', # 気分良い
  #         'rgb(21, 247, 54)',  # いつも通り
  #         'rgba(79, 13, 233, 0.93)', # イライラ
  #         'rgba(255, 21, 21, 0.81)'  # 限界
  #       ],
  #       borderColor: 'rgba(250, 255, 255, 1)', # 境界線を白にする
  #       borderWidth: 2 # 境界線の太さ
  #     }]
  #   }

  #   render json: formatted_data
  # end

  def destroy
    @emotion_log = EmotionLog.find(params[:id])
    if @emotion_log.destroy
      respond_to do |format|
        format.html { redirect_to emotion_logs_path, notice: '削除しました' }
        format.json { render json: { success: true, message: '削除しました', deleted_id: @emotion_log.id } }
      end
    else
      respond_to do |format|
        format.html { redirect_to emotion_logs_path, alert: '削除に失敗しました' }
        format.json { render json: { success: false, message: '削除に失敗しました' } }
      end
    end
  end

  def bookmarks
    @emotion_logs = current_user.bookmark_emotion_logs.order(date: :desc)
                                                      .page(params[:page]||1)
                                                      .per(7)
  end

  private

  def emotion_log_params
    params.require(:emotion_log).permit(:date, :emotion, :description, :music_url, :track_name)
  end

  def ensure_soundcloud_connected
    if current_user && current_user.soundcloud_uid.blank?
      if session[:soundcloud_redirected]
        Rails.logger.warn "⚠️ SoundCloud 無限ループ防止のため、リダイレクトをスキップ"
        return
      end
  
      # ✅ すでに SoundCloud 認証ページにいる場合はリダイレクトしない
      if request.path == "/users/auth/soundcloud" || request.path == "/users/auth/soundcloud/callback"
        Rails.logger.warn "⚠️ すでに SoundCloud 認証ページにいるためリダイレクトしない"
        return
      end
  
      # ✅ 無限ループ防止フラグを設定
      session[:soundcloud_redirected] = true
  
      flash[:alert] = "SoundCloudの連携が必要です。SoundCloud認証ページへ移動します。"
      redirect_to "/users/auth/soundcloud" and return
    else
      # ✅ 認証が完了したらフラグをリセット
      session.delete(:soundcloud_redirected)
    end
  end
  
  

  def calculate_hp(emotion)
    case emotion
    when "めちゃくちゃ気分良い" then 50
    when "気分良い" then 30
    when "いつも通り" then 0
    when "イライラ" then -30
    when "限界" then -50
    else 0
    end
  end
end
