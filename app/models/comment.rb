class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :emotion_log, counter_cache: true  # ← EmotionLog に comments_count カラムを追加すると一覧でも総数が取れます
  has_many :comment_reactions, dependent: :destroy
  validates :body, presence: true
end
