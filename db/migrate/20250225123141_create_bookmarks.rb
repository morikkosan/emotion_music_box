class CreateBookmarks < ActiveRecord::Migration[7.2]
  def change
    create_table :bookmarks do |t|
      t.references :user, foreign_key: true
      t.references :emotion_log, foreign_key: true
      t.timestamps
    end
    add_index :bookmarks, [:user_id, :emotion_log_id], unique: true
  end
end
