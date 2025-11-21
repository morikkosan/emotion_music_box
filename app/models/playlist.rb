# app/models/playlist.rb
class Playlist < ApplicationRecord
  belongs_to :user
  has_many :playlist_items, dependent: :destroy
  has_many :emotion_logs, through: :playlist_items

  validates :name,
            presence: { message: "を入力してください" },
            length:   { maximum: 15, message: "は15文字以内で入力してください" }

  # ✅ ユーザーあたり 12 個まで
  validate :playlist_count_within_limit, on: :create

  # ✅ playlist_items の上限値を Playlist からも参照できるようにしておく
  MAX_ITEMS_PER_PLAYLIST = PlaylistItem::MAX_ITEMS_PER_PLAYLIST

  # ✅ 今、このプレイリストが満杯かどうかを簡単にチェックする用
  def items_limit_reached?
    playlist_items.count >= MAX_ITEMS_PER_PLAYLIST
  end

  private

  def playlist_count_within_limit
    return if user.nil?

    # 新規作成時に user.playlists がすでに12個あるときはエラー
    if user.playlists.count >= 12
      errors.add(:base, "プレイリストは12個までしか作成できません")
    end
  end
end
