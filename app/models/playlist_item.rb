# app/models/playlist_item.rb
class PlaylistItem < ApplicationRecord
  belongs_to :playlist,    touch: true, inverse_of: :playlist_items
  belongs_to :emotion_log,              inverse_of: :playlist_items

  # 同じ emotion_log を同じ playlist に二重登録しない
  validates :emotion_log_id,
            uniqueness: { scope: :playlist_id, message: "はこのプレイリストに重複追加できません" }

  # ✅ 1プレイリストあたり 30 曲まで
  MAX_ITEMS_PER_PLAYLIST = 30

  validate :playlist_items_count_within_limit, on: :create

  private

  def playlist_items_count_within_limit
    return unless playlist

    if playlist.playlist_items.count >= MAX_ITEMS_PER_PLAYLIST
      errors.add(:base, "このプレイリストには#{MAX_ITEMS_PER_PLAYLIST}曲までしか追加できません")
    end
  end
end
