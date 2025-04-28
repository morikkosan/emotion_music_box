class AddUserIdToEmotionLogs < ActiveRecord::Migration[7.2]
  def change
    add_reference :emotion_logs, :user, foreign_key: true, null: true
  end
end
