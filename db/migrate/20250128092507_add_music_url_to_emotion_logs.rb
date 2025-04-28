class AddMusicUrlToEmotionLogs < ActiveRecord::Migration[7.2]
  def change
    add_column :emotion_logs, :music_url, :string
  end
end
