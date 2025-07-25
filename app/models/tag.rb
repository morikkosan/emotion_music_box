# app/models/tag.rb
class Tag < ApplicationRecord
  has_many :emotion_log_tags, dependent: :destroy
  has_many :emotion_logs, through: :emotion_log_tags

  validates :name, presence: true, uniqueness: true
  validates :name,
    presence: true,
    uniqueness: true,
    length: { maximum: 10 },
    format: { with: /\A[a-zA-Z0-9ぁ-んァ-ン一-龥ー]+\z/, message: "記号や特殊文字は使えません" }
end
