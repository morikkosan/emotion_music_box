class PlaylistsController < ApplicationController
  def create
  playlist = current_user.playlists.create!(playlist_params)
  (params[:selected_logs] || []).each do |log_id|
    playlist.playlist_items.create!(emotion_log_id: log_id)
  end
  redirect_to playlists_path, notice: "プレイリストを作成しました"
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
