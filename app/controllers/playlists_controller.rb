# app/controllers/playlists_controller.rb
class PlaylistsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_playlist, only: [ :show, :destroy ]
  before_action :disable_turbo_cache, only: [ :show ]

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
    selected_ids = collect_selected_ids

    @playlist = current_user.playlists.new(playlist_params)

    begin
      Playlist.transaction do

      if selected_ids.blank?
        raise ActiveRecord::RecordInvalid.new(@playlist), "チェックマークが1つも選択されていません"
      end
        @playlist.save!
        # 存在するIDだけに絞った後、重複を避けて安全に作成
        selected_ids.each do |log_id|
          @playlist.playlist_items.find_or_create_by!(emotion_log_id: log_id)
        end
      end

      flash.now[:notice] = "プレイリストを作成しました！"
      respond_with_success
    rescue ActiveRecord::RecordInvalid => e
      # 失敗理由をそのまま表示（既存の分岐を尊重）
      flash.now[:alert] ||= e.record.errors.full_messages.join("、").presence || "チェックマークが1つも選択されていません"
      respond_with_failure
    end
  end

  def show
    # ▼ここから3行が追加/変更（判定の安定化と配列の固定）
    @has_items      = @playlist.playlist_items.exists?
    @playlist_items = @playlist.playlist_items.includes(:emotion_log).order(:created_at).to_a
    @playlist_urls  = @playlist_items.map { |item| item.emotion_log&.music_url }.compact
    # ▲ここまで

    flash.discard(:notice)
  end

  def destroy
    @playlist.destroy
    respond_to do |format|
      format.turbo_stream do
        message = "プレイリストを削除しました。"
        flash_then_redirect = render_to_string(
          inline: <<~ERB,
            <turbo-stream action="append" target="flash">
              <template>
                <div
                  data-controller="flash-then-redirect"
                  data-flash-then-redirect-message="<%= j message %>"
                  data-flash-then-redirect-url="<%= j bookmarks_emotion_logs_path(view: 'mobile') %>"
                  data-flash-then-redirect-title="削除しました"
                  data-flash-then-redirect-icon="success"
                  data-flash-then-redirect-confirm-text="閉じる"></div>
              </template>
            </turbo-stream>
          ERB
          locals: { message: message }
        )
        render turbo_stream: [ flash_then_redirect ]
        flash.discard
      end
      format.html { redirect_to bookmarks_emotion_logs_path, notice: "プレイリストを削除しました。" }
    end
  end

  private

  def playlist_params
    params.require(:playlist).permit(:name)
  end

  def set_playlist
    @playlist = current_user.playlists.includes(playlist_items: :emotion_log).find(params[:id])
  rescue ActiveRecord::RecordNotFound
    redirect_to playlists_path, alert: "指定のプレイリストが見つかりません。"
  end

  # ▼ここを“存在するIDだけ”に正規化（ここだけ修正）
  def collect_selected_ids
    csv_ids   = params[:selected_log_ids].to_s.split(",")
    array_ids = Array(params[:selected_logs])
    raw = (csv_ids + array_ids)
            .map { |v| v.to_s.strip }
            .reject(&:blank?)
            .map(&:to_i)
            .reject(&:zero?)
            .uniq
    # 実在チェック：存在しないIDを弾く（ここが肝）
    EmotionLog.where(id: raw).pluck(:id)
  end

  def render_flash_stream
    render_to_string(
      partial: "shared/flash_container",
      formats: [ :html ],
      locals: { flash: flash }
    )
  end

  def respond_with_success
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          turbo_stream.replace(
            "playlist-modal-content-mobile",
            partial: "emotion_logs/playlist_sidebar",
            locals: { playlists: current_user.playlists.includes(playlist_items: :emotion_log) }
          ),
          turbo_stream.replace(
            "playlist-sidebar",
            partial: "emotion_logs/playlist_sidebar",
            locals: { playlists: current_user.playlists.includes(playlist_items: :emotion_log) }
          ),
          render_flash_stream
        ]
      end
      format.html { redirect_to playlists_path, notice: "プレイリストを作成しました！" }
    end
  end

  def respond_with_failure
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          turbo_stream.update(
            "playlist-modal-container",
            partial: "emotion_logs/playlist_modal",
            locals: { playlist: @playlist }
          ),
          render_flash_stream
        ]
      end
      format.html { render :new, status: :unprocessable_entity }
    end
  end

  def disable_turbo_cache
    response.headers["Cache-Control"] = "no-store"
  end
end
