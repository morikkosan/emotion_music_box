class AddTrackNameToEmotionLogs < ActiveRecord::Migration[7.2]
  def change
    add_column :emotion_logs, :track_name, :string
  end
end
