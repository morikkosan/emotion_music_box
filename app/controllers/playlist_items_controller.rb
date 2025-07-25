class PlaylistItemsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_playlist
  before_action :set_playlist_item, only: [ :destroy ]

  def create
    @item = @playlist.playlist_items.build(emotion_log_id: params[:emotion_log_id])

    if @item.save
      respond_to do |format|
        format.html do
          redirect_to playlist_path(@playlist), notice: "曲を追加しました"
        end

        format.turbo_stream do
          # モーダル内の一覧部分を再レンダー
          render turbo_stream: turbo_stream.replace(
            "addSongsModalBody",
            partial: "playlists/bookmarked_songs",
            locals: { playlist: @playlist }
          )
        end
      end

    else
      respond_to do |format|
        format.html do
          redirect_to playlist_path(@playlist),
            alert: "曲の追加に失敗しました: #{@item.errors.full_messages.join(', ')}"
        end

        format.turbo_stream do
          render turbo_stream: [
            turbo_stream.replace(
              helpers.dom_id(@playlist, :contents),
              partial: "playlists/playlist_contents",
              locals: { playlist: @playlist }
            ),
            turbo_stream.append(
              "flash_messages",
              partial: "shared/flash_container",
              locals: { flash: { alert: "曲の追加に失敗しました: #{@item.errors.full_messages.join(', ')}" } }
            )
          ]
        end
      end
    end
  end

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
