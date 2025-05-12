class CommentReaction < ApplicationRecord
  enum :kind, { sorena: 0, yonda: 1 }
  belongs_to :user
  belongs_to :comment, counter_cache: :reactions_count
  validates :kind, uniqueness: { scope: %i[user_id comment_id] } # 1 人 1 種類 1 回
end
