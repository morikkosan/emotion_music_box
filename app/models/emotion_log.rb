class EmotionLog < ApplicationRecord
  belongs_to :user
  has_many :bookmarks, dependent: :destroy
  has_many :bookmark_users, through: :bookmarks, source: :user  # EmotionLogをブックマークしたユーザーを取得
  has_many :comments,  dependent: :destroy

  validates :date, presence: true
  # 値が決まったときに修正
  # validates :emotion, presence: true, inclusion: { in: %w[]}
  validates :emotion, presence: true
  validates :description, presence: true
  validates :music_url, presence: true
  validate :date_cannot_be_in_the_future

  private
  def date_cannot_be_in_the_future
    if date.present? && date > Date.today
      errors.add(:date, "は未来の日付を選択できません")
    end
  end
end
