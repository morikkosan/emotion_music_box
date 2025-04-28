class Bookmark < ApplicationRecord
  belongs_to :user
  belongs_to :emotion_log
end
