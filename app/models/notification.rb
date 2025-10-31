# app/models/notification.rb
class Notification < ApplicationRecord
  belongs_to :user

  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc) }

  validates :title, presence: true
  validates :kind,  presence: true

  enum kind: {
    emotion_log:  "emotion_log",
    comment:      "comment",
    bookmark:     "bookmark",
    reaction:     "reaction",
    generic:      "generic"
  }, _suffix: true
end
