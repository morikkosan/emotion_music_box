class BookmarksController < ApplicationController

  
   def create
    @emotion_log = EmotionLog.find(params[:emotion_log_id])
    current_user.bookmark(@emotion_log)  # or create!(emotion_log_id: ...)
    @emotion_log.reload
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to emotion_logs_path, notice: "ブックマークしました" }
    end
  end

  def destroy
    bookmark = current_user.bookmarks.find(params[:id])
    @emotion_log = bookmark.emotion_log
    bookmark.destroy
    @emotion_log.reload  # 最新のデータを取得
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to emotion_logs_path, notice: "ブックマーク解除しました" }
    end
  end
end