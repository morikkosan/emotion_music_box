# app/controllers/bookmarks_controller.rb
class BookmarksController < ApplicationController
  before_action :set_emotion_log, only: %i[create toggle]
  before_action :authenticate_user!

  # POST /bookmarks           （link_to … turbo_method: :post）
  def create
    current_user.bookmarks.find_or_create_by!(emotion_log: @emotion_log)

    # 投稿者が自分以外なら通知（購読可否・有効/無効は PushNotifier 側で判定）
    if @emotion_log.user != current_user
      begin
        PushNotifier.send_bookmark_notification(
          @emotion_log.user,
          by_user_name: current_user.name,
          track_name:   @emotion_log.track_name || "あなたの投稿"
        )
      rescue => e
        Rails.logger.warn("send_bookmark_notification failed: #{e.class}: #{e.message}")
      end
    end

    respond_to do |format|
      format.turbo_stream                      # create.turbo_stream.erb を想定
      format.html { redirect_to emotion_logs_path, notice: "ブックマークしました" }
    end
  end

  # DELETE /bookmarks/:id
  def destroy
    bookmark     = current_user.bookmarks.find(params[:id])
    @emotion_log = bookmark.emotion_log
    bookmark.destroy

    respond_to do |format|
      format.turbo_stream                      # destroy.turbo_stream.erb
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

    # 「付与時のみ」通知。自分以外の投稿なら送る（細かい条件は PushNotifier 側で判定）
    if @toggled && @emotion_log.user != current_user
      begin
        PushNotifier.send_bookmark_notification(
          @emotion_log.user,
          by_user_name: current_user.name,
          track_name:   @emotion_log.track_name || "あなたの投稿"
        )
      rescue => e
        Rails.logger.warn("send_bookmark_notification failed: #{e.class}: #{e.message}")
      end
    end

    respond_to do |format|
      format.turbo_stream                      # toggle.turbo_stream.erb
      format.html { redirect_back fallback_location: root_path }
    end
  # :nocov:
  rescue ActiveRecord::RecordNotUnique
    retry
    # :nocov:
  end

  private

  def set_emotion_log
    @emotion_log = EmotionLog.find(params[:emotion_log_id])
  end
end
