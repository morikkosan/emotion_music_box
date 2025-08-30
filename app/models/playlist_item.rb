class PlaylistItem < ApplicationRecord
  belongs_to :playlist,    touch: true, inverse_of: :playlist_items
  belongs_to :emotion_log,              inverse_of: :playlist_items

  # 同じ emotion_log を同じ playlist に二重登録しない
  validates :emotion_log_id,
            uniqueness: { scope: :playlist_id, message: "はこのプレイリストに重複追加できません" }
end
