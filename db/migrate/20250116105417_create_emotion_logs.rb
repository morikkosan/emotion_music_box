class CreateEmotionLogs < ActiveRecord::Migration[7.2]
  def change
    create_table :emotion_logs do |t|
      t.string :emotion
      t.text :description

      t.timestamps
    end
  end
end
