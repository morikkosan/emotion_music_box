class Playlist < ApplicationRecord
  belongs_to :user
  has_many :playlist_items, dependent: :destroy
  has_many :emotion_logs, through: :playlist_items

  validates :name,
            presence: { message: "を入力してください" },
            length:   { maximum: 15, message: "は15文字以内で入力してください" }

  validate :playlist_count_within_limit, on: :create

  private

  def playlist_count_within_limit
      return if user.nil?
    # 新規作成時に user.playlists がすでに12個あるときはエラー
    if user.playlists.count >= 12
      errors.add(:base, "プレイリストは12個までしか作成できません")
    end
  end
end
