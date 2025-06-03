class PlaylistsController < ApplicationController


  # PlaylistsController
def new
  @playlist = Playlist.new
  respond_to do |format|
    format.turbo_stream {
      render turbo_stream: turbo_stream.replace(
        "modal-container",
        partial: "emotion_logs/playlist_modal",
        locals: { playlist: @playlist }
      )
    }
    format.html
  end
end

 def create
  @playlist = current_user.playlists.create!(playlist_params)
  (params[:selected_logs] || []).each do |log_id|
    @playlist.playlist_items.create!(emotion_log_id: log_id)
  end
  respond_to do |format|
    format.turbo_stream {
      # モーダルだけ閉じるだけ！JSはコントローラ側で発火
      render turbo_stream: turbo_stream.remove("modal-container")
    }
    format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
  end
end





  def index
    @playlists = current_user.playlists.includes(:playlist_items)
  end

  def show
    @playlist = current_user.playlists.find(params[:id])
  end

  private
  def playlist_params
    params.require(:playlist).permit(:name)
  end
end
