class SwapFkPlaylistItemsEmotionLogsToCascade < ActiveRecord::Migration[7.2]
  def up
    # あなたの環境ログで出ていた既存FK名: fk_rails_70cd5941fd
    remove_foreign_key :playlist_items, name: "fk_rails_70cd5941fd"

    add_foreign_key :playlist_items, :emotion_logs,
                    column: :emotion_log_id,
                    on_delete: :cascade,
                    name: "fk_playlist_items_emotion_logs_cascade"
  end

  def down
    remove_foreign_key :playlist_items, name: "fk_playlist_items_emotion_logs_cascade"

    add_foreign_key :playlist_items, :emotion_logs,
                    column: :emotion_log_id,
                    name: "fk_rails_70cd5941fd"
  end
end
