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
  validate :description_must_be_polite
  validates :description, presence: true, length: { maximum: 50 }

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

  def description_must_be_polite
    return if description.blank?

    # NGワード（例）
    forbidden_words = %w[死ね 殺す ぶっ殺す バカ やばい キモ うざ ちんこ まんこ]

    if forbidden_words.any? { |w| description.include?(w) }
      errors.add(:description, "に過激な表現が含まれています。やさしい言葉でお願いします。")
    end

    if description =~ /[!@#$%^&*()_+={}\[\]:;"'<>,.?\/\\|-]/
      errors.add(:description, "に記号や特殊文字は使用できません。")
    end
  end
end
