# app/models/tag.rb
class Tag < ApplicationRecord
  has_many :emotion_log_tags, dependent: :destroy
  has_many :emotion_logs, through: :emotion_log_tags

  validates :name, presence: true, uniqueness: true
end
