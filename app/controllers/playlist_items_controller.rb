# app/controllers/playlist_items_controller.rb
class PlaylistItemsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_playlist
  before_action :set_playlist_item, only: [:destroy]

  # --------------------------------------------------
  # 曲をプレイリストから削除する
  # --------------------------------------------------
  def destroy
    @playlist_item.destroy

    respond_to do |format|
      format.html do
        redirect_to playlist_path(@playlist), notice: "曲をプレイリストから削除しました。"
      end

      format.turbo_stream do
        render turbo_stream: turbo_stream.replace(
          helpers.dom_id(@playlist, :contents),
          partial: "playlists/playlist_contents",
          locals: { playlist: @playlist }
        )
      end
    end
  end

  private

  def set_playlist
    @playlist = current_user.playlists.find(params[:playlist_id])
  end

  def set_playlist_item
    @playlist_item = @playlist.playlist_items.find(params[:id])
  end
end
