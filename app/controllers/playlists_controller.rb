# app/controllers/playlists_controller.rb
class PlaylistsController < ApplicationController
  def new
    @playlist = Playlist.new
    respond_to do |format|
      format.turbo_stream {
        render turbo_stream: turbo_stream.update(
          "modal-container",
          partial: "emotion_logs/playlist_modal",
          locals: { playlist: @playlist }
        )
      }
      format.html
    end
  end

  def create
  @playlist = current_user.playlists.new(playlist_params)
  selected = Array(params[:selected_logs]) # nil対策で Array に変換

  if @playlist.save && selected.any?
    # ✅ 正常時の処理
    selected.each do |log_id|
      @playlist.playlist_items.create!(emotion_log_id: log_id)
    end

    flash[:notice] = "プレイリストを作成しました！"

    respond_to do |format|
      format.turbo_stream do
        close_modal = turbo_stream.update("modal-container", "")
        show_flash = turbo_stream.append("flash", partial: "shared/flash_container")
        render turbo_stream: [close_modal, show_flash]
      end
      format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
    end

  else
    # ❌ エラーパターン（バリデーション or チェックなし）
    if !selected.any?
      flash[:alert] = "チェックマークが1つも選択されていません"
    elsif @playlist.errors.any?
      flash[:alert] = @playlist.errors.full_messages.join("、")
    else
      flash[:alert] = "プレイリストの作成に失敗しました"
    end

    respond_to do |format|
      format.turbo_stream do
        retry_modal = turbo_stream.update(
          "modal-container",
          partial: "emotion_logs/playlist_modal",
          locals: { playlist: @playlist }
        )
        show_flash = turbo_stream.append("flash", partial: "shared/flash_container")
        render turbo_stream: [retry_modal, show_flash]
      end
      format.html { render :new, status: :unprocessable_entity }
    end
  end
end


  private

  def playlist_params
    params.require(:playlist).permit(:name)
  end
end
