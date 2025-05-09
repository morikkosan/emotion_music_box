class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :emotion_log, counter_cache: true  # ← EmotionLog に comments_count カラムを追加すると一覧でも総数が取れます
  has_many :comment_reactions, dependent: :destroy
  validates :body, presence: true

# app/models/comment.rb
  def preloaded_reactions
    @preloaded_reactions ||= comment_reactions.to_a
  end

  def reaction_count(kind)
    preloaded_reactions.count { |r| r.kind.to_s == kind.to_s }
  end

  def reacted_by?(user, kind)
    preloaded_reactions.any? { |r| r.user_id == user.id && r.kind.to_s == kind.to_s }
  end

end

