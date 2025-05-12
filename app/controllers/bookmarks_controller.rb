class BookmarksController < ApplicationController
  before_action :set_emotion_log, only: %i[create toggle]

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
                 true
               end

    respond_to do |format|
      format.turbo_stream      # toggle.turbo_stream.erb
      format.html { redirect_back fallback_location: root_path }
    end
  rescue ActiveRecord::RecordNotUnique
    retry                     # まれに競合したとき用
  end

  private

  def set_emotion_log
    @emotion_log = EmotionLog.find(params[:emotion_log_id])
  end
end
