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
    selected = Array(params[:selected_logs])

    if selected.any?
      @playlist = current_user.playlists.new(playlist_params)

      if @playlist.save
        selected.each do |log_id|
          @playlist.playlist_items.create!(emotion_log_id: log_id)
        end

        flash.now[:notice] = "プレイリストを作成しました！"

        respond_to do |format|
          format.turbo_stream do
            close_modal = turbo_stream.update("playlist-modal-container", "")
            show_flash = turbo_stream.append("flash", partial: "shared/flash_container", locals: { flash: flash })
            replace_sidebar = turbo_stream.replace(
              "playlist-sidebar",
              partial: "emotion_logs/playlist_sidebar",
              locals: {
                playlists: current_user.playlists.includes(playlist_items: :emotion_log)
              }
            )
            trigger_flash = render_trigger_flash

            render turbo_stream: [
              close_modal,
              show_flash,
              replace_sidebar,
              trigger_flash
            ]
          end

          format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
        end
      else
        flash[:alert] = @playlist.errors.full_messages.join("、")
        respond_to do |format|
          format.turbo_stream do
            retry_modal = turbo_stream.update(
              "playlist-modal-container",
              partial: "emotion_logs/playlist_modal",
              locals: { playlist: @playlist }
            )
            show_flash = turbo_stream.append("flash", partial: "shared/flash_container", locals: { flash: flash })
            render turbo_stream: [retry_modal, show_flash]
          end
          format.html { render :new, status: :unprocessable_entity }
        end
      end

    else
      @playlist = current_user.playlists.new(playlist_params)
      flash[:alert] = "チェックマークが1つも選択されていません"
      respond_to do |format|
        format.turbo_stream do
          retry_modal = turbo_stream.update(
            "playlist-modal-container",
            partial: "emotion_logs/playlist_modal",
            locals: { playlist: @playlist }
          )
          show_flash = turbo_stream.append("flash", partial: "shared/flash_container", locals: { flash: flash })
          render turbo_stream: [retry_modal, show_flash]
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
    flash.now[:notice] = "プレイリストを削除しました。"

    respond_to do |format|
      format.turbo_stream do
        show_flash = turbo_stream.append("flash", partial: "shared/flash_container", locals: { flash: flash })
        replace_sidebar = turbo_stream.replace(
          "playlist-sidebar",
          partial: "emotion_logs/playlist_sidebar",
          locals: {
            playlists: current_user.playlists.includes(playlist_items: :emotion_log)
          }
        )
        trigger_flash = render_trigger_flash

        render turbo_stream: [show_flash, replace_sidebar, trigger_flash]
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
