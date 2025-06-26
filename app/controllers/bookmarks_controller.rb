class BookmarksController < ApplicationController
  before_action :set_emotion_log, only: %i[create toggle]
  before_action :authenticate_user!

  # POST /bookmarks           （link_to … turbo_method: :post）
  def create
    current_user.bookmarks.find_or_create_by!(emotion_log: @emotion_log)

    respond_to do |format|
      format.turbo_stream      # create.turbo_stream.erb
      format.html { redirect_to emotion_logs_path, notice: "ブックマークしました" }
    end
  end

  # DELETE /bookmarks/:id
  def destroy
    bookmark    = current_user.bookmarks.find(params[:id])
    @emotion_log = bookmark.emotion_log
    bookmark.destroy

    respond_to do |format|
      format.turbo_stream      # destroy.turbo_stream.erb
      format.html { redirect_to emotion_logs_path, notice: "ブックマーク解除しました" }
    end
  end

  # POST /bookmarks/toggle    （link_to … turbo_method: :post）
  def toggle
  bookmark = current_user.bookmarks.find_by(emotion_log: @emotion_log)

  @toggled = if bookmark
              bookmark.destroy
              false
            else
              current_user.bookmarks.create!(emotion_log: @emotion_log)

            # ✅ 投稿者が自分でない場合のみ通知
            if @emotion_log.user != current_user && @emotion_log.user.line_user_id.present?
              LineBotController.new.send_bookmark_notification(
                  @emotion_log.user,
                  by_user_name: current_user.name,
                  track_name: @emotion_log.track_name || "あなたの投稿"
                )
              end

              true
            end

  respond_to do |format|
    format.turbo_stream
    format.html { redirect_back fallback_location: root_path }
  end
rescue ActiveRecord::RecordNotUnique
  retry
end

  private

  def set_emotion_log
    @emotion_log = EmotionLog.find(params[:emotion_log_id])
  end
end
