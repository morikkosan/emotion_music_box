class Playlist < ApplicationRecord
  belongs_to :user
  has_many :playlist_items, dependent: :destroy
  has_many :emotion_logs, through: :playlist_items

  validates :name,
            presence: { message: "を入力してください" },
            length:   { maximum: 15, message: "は15文字以内で入力してください" }
end
