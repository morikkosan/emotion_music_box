# db/migrate/xxxx_add_comments_count_to_emotion_logs.rb
class AddCommentsCountToEmotionLogs < ActiveRecord::Migration[7.1]
  def change
    add_column :emotion_logs, :comments_count, :integer, null: false, default: 0
  end
end
