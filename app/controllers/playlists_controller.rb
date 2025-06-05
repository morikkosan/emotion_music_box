# app/controllers/playlists_controller.rb
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
  @playlist = current_user.playlists.new(playlist_params)
  selected = Array(params[:selected_logs])

  # ここで save が走り、もし同ユーザーのプレイリストが12個を超えていれば save が false となる
  if @playlist.save && selected.any?
    # 正常に作成できた場合（12個未満かつ selected.any?）の処理…
    selected.each do |log_id|
      @playlist.playlist_items.create!(emotion_log_id: log_id)
    end

    flash[:notice] = "プレイリストを作成しました！"
    respond_to do |format|
      format.turbo_stream do
        close_modal = turbo_stream.update("playlist-modal-container", "")
        show_flash  = turbo_stream.append("flash", partial: "shared/flash_container")
        replace_sidebar = turbo_stream.replace(
          "playlist-sidebar",
          partial: "emotion_logs/playlist_sidebar",
          locals: {
            playlists: current_user.playlists.includes(playlist_items: :emotion_log)
          }
        )
        render turbo_stream: [close_modal, show_flash, replace_sidebar]
      end
      format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
    end

  else
    # ① チェックが１つも入っていない or ② save が失敗（バリデーションエラー）した場合
    if selected.empty?
      flash[:alert] = "チェックマークが1つも選択されていません"
    elsif @playlist.errors.any?
      # ここに「プレイリストは12個までしか作成できません」が入る
      flash[:alert] = @playlist.errors.full_messages.join("、")
    else
      flash[:alert] = "プレイリストの作成に失敗しました"
    end

    respond_to do |format|
      format.turbo_stream do
        retry_modal = turbo_stream.update(
          "playlist-modal-container",
          partial: "emotion_logs/playlist_modal",
          locals: { playlist: @playlist }
        )
        show_flash  = turbo_stream.append("flash", partial: "shared/flash_container")
        render turbo_stream: [retry_modal, show_flash]
      end
      format.html { render :new, status: :unprocessable_entity }
    end
  end
end

  def show
    # @playlist は set_playlist でセット済み
  end

   def destroy
    @playlist.destroy
    redirect_to bookmarks_emotion_logs_path, notice: "プレイリストを削除しました。"
  end

  private

  def playlist_params
    params.require(:playlist).permit(:name)
  end

  def set_playlist
    @playlist = current_user.playlists
                    .includes(playlist_items: :emotion_log)
                    .find(params[:id])
  rescue ActiveRecord::RecordNotFound
    redirect_to playlists_path, alert: "指定のプレイリストが見つかりません。"
  end
end
