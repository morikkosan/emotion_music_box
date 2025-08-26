# app/controllers/playlists_controller.rb
require 'securerandom'

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
    # 2系統の入力をマージ
    csv_ids   = params[:selected_log_ids].to_s.split(",")
    array_ids = Array(params[:selected_logs])
    selected_ids = (csv_ids + array_ids).map(&:to_i).reject(&:zero?).uniq

    if selected_ids.any?
      @playlist = current_user.playlists.new(playlist_params)
      if @playlist.save
        selected_ids.each { |log_id| @playlist.playlist_items.create!(emotion_log_id: log_id) }

        flash.now[:notice] = "プレイリストを作成しました！"

        respond_to do |format|
          format.turbo_stream do
            # ★ ここがポイント：formats を :html に固定
            flash_stream = render_to_string(
              partial: "shared/flash_container",
              formats: [:html],
              locals: { flash: flash }
            )

            render turbo_stream: [
              # モバイル側モーダル中身の差し替え（入力クリアも兼ねる）
              turbo_stream.replace(
                "playlist-modal-content-mobile",
                partial: "emotion_logs/playlist_sidebar",
                locals: { playlists: current_user.playlists.includes(playlist_items: :emotion_log) }
              ),
              # デスクトップ側サイドバー差し替え
              turbo_stream.replace(
                "playlist-sidebar",
                partial: "emotion_logs/playlist_sidebar",
                locals: { playlists: current_user.playlists.includes(playlist_items: :emotion_log) }
              ),
              # フラッシュはトップレベル <turbo-stream> の文字列をそのまま返す
              flash_stream
            ]
          end

          format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
        end
      else
        flash.now[:alert] = @playlist.errors.full_messages.join("、")
        respond_to do |format|
          format.turbo_stream do
            flash_stream = render_to_string(
              partial: "shared/flash_container",
              formats: [:html],
              locals: { flash: flash }
            )

            render turbo_stream: [
              turbo_stream.update(
                "playlist-modal-container",
                partial: "emotion_logs/playlist_modal",
                locals: { playlist: @playlist }
              ),
              flash_stream
            ]
          end
          format.html { render :new, status: :unprocessable_entity }
        end
      end
    else
      @playlist = current_user.playlists.new(playlist_params)
      flash.now[:alert] = "チェックマークが1つも選択されていません"
      respond_to do |format|
        format.turbo_stream do
          flash_stream = render_to_string(
            partial: "shared/flash_container",
            formats: [:html],
            locals: { flash: flash }
          )

          render turbo_stream: [
            turbo_stream.update(
              "playlist-modal-container",
              partial: "emotion_logs/playlist_modal",
              locals: { playlist: @playlist }
            ),
            flash_stream
          ]
        end
        format.html { render :new, status: :unprocessable_entity }
      end
    end
  end

  def show
    @playlist_urls = @playlist.playlist_items.includes(:emotion_log).map { |item| item.emotion_log.music_url }
    flash.discard(:notice)
  end

  def destroy
    @playlist.destroy
    flash[:notice] = "プレイリストを削除しました。"

    respond_to do |format|
      format.turbo_stream do
        # 既存の演出は尊重
        flash_then_redirect = render_to_string(inline: <<~ERB)
          <turbo-stream action="append" target="flash">
            <template>
              <div
                data-controller="flash-then-redirect"
                data-flash-then-redirect-message="<%= j flash[:notice] %>"
                data-flash-then-redirect-url="#{bookmarks_emotion_logs_path(view: 'mobile')}"
                data-flash-then-redirect-title="削除しました"
                data-flash-then-redirect-icon="success"
                data-flash-then-redirect-confirm-text="閉じる"></div>
            </template>
          </turbo-stream>
        ERB
        render turbo_stream: [flash_then_redirect]
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
    @playlist = current_user.playlists
                    .includes(playlist_items: :emotion_log)
                    .find(params[:id])
  rescue ActiveRecord::RecordNotFound
    redirect_to playlists_path, alert: "指定のプレイリストが見つかりません。"
  end

  # 使わない（競合回避のため未使用）
  def render_trigger_flash
    render_to_string(inline: <<~ERB)
      <turbo-stream action="remove" target="flash-container"></turbo-stream>
      <turbo-stream action="append" target="flash">
        <template>
          <div id="flash-container" data-flash-notice="#{j flash[:notice]}" data-flash-alert="#{j flash[:alert]}"></div>
        </template>
      </turbo-stream>
    ERB
  end
end
