class AddDateToEmotionLogs < ActiveRecord::Migration[7.2]
  def change
    add_column :emotion_logs, :date, :date
  end
end
