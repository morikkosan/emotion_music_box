class AddMusicArtUrlToEmotionLogs < ActiveRecord::Migration[7.2]
  def change
    add_column :emotion_logs, :music_art_url, :string
  end
end
