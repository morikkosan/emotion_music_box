# app/controllers/playlists_controller.rb
class PlaylistsController < ApplicationController
  before_action :authenticate_user!

  # --------------------------------------------------
  # 一覧表示（サイドバーや index ビュー向け）
  # --------------------------------------------------
  def index
    @playlists = current_user
                   .playlists
                   .includes(playlist_items: :emotion_log)
  end

  # --------------------------------------------------
  # 新規モーダルを表示（Turbo Stream 経由）
  # --------------------------------------------------
  def new
    @playlist = Playlist.new

    respond_to do |format|
      format.turbo_stream do
        # "playlist-modal-container" 枠の中身だけをフォーム partial に置き換える
        render turbo_stream: turbo_stream.update(
          "playlist-modal-container",
          partial: "emotion_logs/playlist_modal",
          locals: { playlist: @playlist }
        )
      end
      format.html
    end
  end

  # --------------------------------------------------
  # 作成処理
  # --------------------------------------------------
  def create
    @playlist = current_user.playlists.new(playlist_params)
    selected = Array(params[:selected_logs]) # チェックボックスで選ばれたログID

    if @playlist.save && selected.any?
      # チェックされたログIDを playlist_items に登録
      selected.each do |log_id|
        @playlist.playlist_items.create!(emotion_log_id: log_id)
      end

      flash[:notice] = "プレイリストを作成しました！"

      respond_to do |format|
        format.turbo_stream do
          # 1) プレイリスト作成用モーダル枠の中身だけを空にして閉じる
          close_modal = turbo_stream.update("playlist-modal-container", "")

          # 2) フラッシュメッセージを表示
          show_flash = turbo_stream.append("flash", partial: "shared/flash_container")

          # 3) サイドバーのプレイリスト一覧を最新のものに置き換える
          replace_sidebar = turbo_stream.replace(
            "playlist-sidebar",
            partial: "emotion_logs/playlist_sidebar",
            locals: {
              playlists: current_user
                             .playlists
                             .includes(playlist_items: :emotion_log)
            }
          )

          render turbo_stream: [close_modal, show_flash, replace_sidebar]
        end

        format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
      end

    else
      # エラー時のメッセージをセット
      if selected.empty?
        flash[:alert] = "チェックマークが1つも選択されていません"
      elsif @playlist.errors.any?
        flash[:alert] = @playlist.errors.full_messages.join("、")
      else
        flash[:alert] = "プレイリストの作成に失敗しました"
      end

      respond_to do |format|
        format.turbo_stream do
          # 再度モーダル枠の中身だけをエラー付きフォーム partial に置き換える
          retry_modal = turbo_stream.update(
            "playlist-modal-container",
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

  # --------------------------------------------------
  # show（個別プレイリスト表示）
  # --------------------------------------------------
  def show
    @playlist = current_user
                  .playlists
                  .includes(playlist_items: :emotion_log)
                  .find(params[:id])
  rescue ActiveRecord::RecordNotFound
    redirect_to playlists_path, alert: "指定のプレイリストが見つかりません。"
  end

  private

  def playlist_params
    params.require(:playlist).permit(:name)
  end
end
