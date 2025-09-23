# db/migrate/20250827225500_add_unique_index_to_playlist_items.rb
class AddUniqueIndexToPlaylistItems < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!  # ← algorithm: :concurrently を使うため

  def up
    # 1) 既存の重複を削除（同一 (playlist_id, emotion_log_id) の中でIDの大きい方を消す）
    execute <<~SQL
      DELETE FROM playlist_items a
      USING playlist_items b
      WHERE a.id > b.id
        AND a.playlist_id = b.playlist_id
        AND a.emotion_log_id = b.emotion_log_id;
    SQL

    # 2) 一意インデックスを同時実行で貼る（テーブルロックを最小化）
    add_index :playlist_items,
              [ :playlist_id, :emotion_log_id ],
              unique: true,
              algorithm: :concurrently,
              name: "index_playlist_items_on_playlist_and_emotion_log"
  end

  def down
    remove_index :playlist_items,
                 name: "index_playlist_items_on_playlist_and_emotion_log",
                 algorithm: :concurrently
  end
end
