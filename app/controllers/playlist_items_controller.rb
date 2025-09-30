# app/controllers/playlist_items_controller.rb
class PlaylistItemsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_playlist
  before_action :set_playlist_item, only: [ :destroy ]

  def create
    @item = @playlist.playlist_items.build(emotion_log_id: params[:emotion_log_id])

    if @item.save
      render_update_streams(notice: "曲を追加しました")
    else
      render_update_streams(alert: "曲の追加に失敗しました: #{@item.errors.full_messages.join(', ')}")
    end
  end

  def destroy
    @playlist_item.destroy
    render_update_streams(notice: "曲をプレイリストから削除しました。")
  end

  private

  def set_playlist
    @playlist = current_user.playlists.find(params[:playlist_id])
  end

  def set_playlist_item
    @playlist_item = @playlist.playlist_items.find(params[:id])
  end

  # 画面再描画を 1 箇所に集約（HTML/Turbo Stream の両対応）
  def render_update_streams(notice: nil, alert: nil)
    # パーシャルと show の表示を揃えるため、常に同じ items/has_items を用意
    @playlist_items = @playlist.playlist_items
                               .includes(:emotion_log)
                               .order(created_at: :desc)
    @has_items = @playlist_items.exists?

    respond_to do |format|
      format.html do
        # HTML遷移時は show に戻す（flash も忘れず）
        if alert
          redirect_to playlist_path(@playlist), alert: alert
        else
          redirect_to playlist_path(@playlist), notice: (notice || "更新しました")
        end
      end

      format.turbo_stream do
        streams = [
          # ① プレイリスト本体を置換（置換先の id は view 側に必須）
          turbo_stream.replace(
            helpers.dom_id(@playlist, :contents),
            partial: "playlists/playlist_contents",
            locals: {
              playlist: @playlist,
              playlist_items: @playlist_items,
              has_items: @has_items
            }
          ),
          # ② モーダル内「ブックマーク済みの曲一覧」を最新化
          turbo_stream.replace(
            "addSongsModalBody",
            partial: "playlists/bookmarked_songs",
            locals: { playlist: @playlist }
          )
        ]

        # ③ 失敗時はフラッシュも積む
        if alert
          streams << turbo_stream.append(
            "flash_messages",
            partial: "shared/flash_container",
            locals: { flash: { alert: alert } }
          )
        elsif notice
          streams << turbo_stream.append(
            "flash_messages",
            partial: "shared/flash_container",
            locals: { flash: { notice: notice } }
          )
        end

        render turbo_stream: streams
      end
    end
  end
end
