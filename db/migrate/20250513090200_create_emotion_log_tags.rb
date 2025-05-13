# db/migrate/xxxxxx_create_emotion_log_tags.rb
class CreateEmotionLogTags < ActiveRecord::Migration[7.0]
  def change
    create_table :emotion_log_tags do |t|
      t.references :emotion_log, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true

      t.timestamps
    end

    add_index :emotion_log_tags, [:emotion_log_id, :tag_id], unique: true
  end
end
