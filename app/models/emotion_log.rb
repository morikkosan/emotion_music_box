class EmotionLog < ApplicationRecord
  belongs_to :user
  has_many :bookmarks, dependent: :destroy
  has_many :bookmark_users, through: :bookmarks, source: :user  # EmotionLogをブックマークしたユーザーを取得
  has_many :comments,  dependent: :destroy
  has_many :emotion_log_tags, dependent: :destroy
  has_many :tags, through: :emotion_log_tags

    attr_accessor :tag_names
      after_save :assign_tags


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

  def assign_tags
    return if tag_names.blank?

    self.tags = tag_names.split(',').map do |tag_name|
      Tag.find_or_create_by(name: tag_name.strip)
    end
  end
end
