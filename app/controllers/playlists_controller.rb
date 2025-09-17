class PlaylistsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_playlist, only: [:show, :destroy]

  def index
    @playlists = current_user.playlists.includes(playlist_items: :emotion_log)
  end

  def new
    @playlist = Playlist.new
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.update(
          "playlist-modal-container",
          partial: "emotion_logs/playlist_modal",
          locals: { playlist: @playlist }
        )
      end
      format.html
    end
  end

  def create
    selected_ids = collect_selected_ids

    @playlist = current_user.playlists.new(playlist_params)

    if selected_ids.any? && @playlist.save
      selected_ids.each { |log_id| @playlist.playlist_items.create!(emotion_log_id: log_id) }
      flash.now[:notice] = "プレイリストを作成しました！"
      respond_with_success
    else
      flash.now[:alert] ||= @playlist.errors.full_messages.join("、").presence || "チェックマークが1つも選択されていません"
      respond_with_failure
    end
  end

  def show
    @playlist_urls = @playlist.playlist_items.includes(:emotion_log).map { |item| item.emotion_log.music_url }
    flash.discard(:notice) # 意図的に notice を消している（2重表示防止）
  end

  def destroy
    @playlist.destroy

    respond_to do |format|
      format.turbo_stream do
        message = "プレイリストを削除しました。"
        flash_then_redirect = render_to_string(
          inline: <<~ERB,
            <turbo-stream action="append" target="flash">
              <template>
                <div
                  data-controller="flash-then-redirect"
                  data-flash-then-redirect-message="<%= j message %>"
                  data-flash-then-redirect-url="<%= j bookmarks_emotion_logs_path(view: 'mobile') %>"
                  data-flash-then-redirect-title="削除しました"
                  data-flash-then-redirect-icon="success"
                  data-flash-then-redirect-confirm-text="閉じる"></div>
              </template>
            </turbo-stream>
          ERB
          locals: { message: message }
        )
        render turbo_stream: [flash_then_redirect]
        flash.discard
      end

      format.html do
        redirect_to bookmarks_emotion_logs_path, notice: "プレイリストを削除しました。"
      end
    end
  end

  private

  def playlist_params
    params.require(:playlist).permit(:name)
  end

  def set_playlist
    @playlist = current_user.playlists.includes(playlist_items: :emotion_log).find(params[:id])
  rescue ActiveRecord::RecordNotFound
    redirect_to playlists_path, alert: "指定のプレイリストが見つかりません。"
  end

  def collect_selected_ids
    csv_ids   = params[:selected_log_ids].to_s.split(",")
    array_ids = Array(params[:selected_logs])
    (csv_ids + array_ids).map(&:to_i).reject(&:zero?).uniq
  end

  def render_flash_stream
    render_to_string(
      partial: "shared/flash_container",
      formats: [:html],
      locals: { flash: flash }
    )
  end

  def respond_with_success
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          turbo_stream.replace(
            "playlist-modal-content-mobile",
            partial: "emotion_logs/playlist_sidebar",
            locals: { playlists: current_user.playlists.includes(playlist_items: :emotion_log) }
          ),
          turbo_stream.replace(
            "playlist-sidebar",
            partial: "emotion_logs/playlist_sidebar",
            locals: { playlists: current_user.playlists.includes(playlist_items: :emotion_log) }
          ),
          render_flash_stream
        ]
      end
      format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
    end
  end

  def respond_with_failure
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          turbo_stream.update(
            "playlist-modal-container",
            partial: "emotion_logs/playlist_modal",
            locals: { playlist: @playlist }
          ),
          render_flash_stream
        ]
      end
      format.html { render :new, status: :unprocessable_entity }
    end
  end
end
