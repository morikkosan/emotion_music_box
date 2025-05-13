class EmotionLogTag < ApplicationRecord
  belongs_to :emotion_log
  belongs_to :tag
end
