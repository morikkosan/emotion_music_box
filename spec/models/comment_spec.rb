require 'rails_helper'

RSpec.describe Comment, type: :model do
  describe "バリデーション" do
    it { should validate_presence_of(:body) }
  end

  describe "アソシエーション" do
    it { should belong_to(:user) }
    it { should belong_to(:emotion_log).counter_cache(true) }
    it { should have_many(:comment_reactions).dependent(:destroy) }

    it "コメントを削除するとリアクションも削除される" do
    comment = create(:comment)
    create_list(:comment_reaction, 3, comment: comment)

    expect {
      comment.destroy
    }.to change { CommentReaction.count }.by(-3)
    end
  end

  describe "#reaction_count" do
    it "指定した種類のリアクション数を返す" do
      comment = create(:comment)
      create(:comment_reaction, comment: comment, kind: :sorena)
      create(:comment_reaction, comment: comment, kind: :sorena)
      create(:comment_reaction, comment: comment, kind: :yonda)

      expect(comment.reaction_count(:sorena)).to eq 2
      expect(comment.reaction_count(:yonda)).to eq 1
      expect(comment.reaction_count(:nani)).to eq 0
    end
  end

  describe "#reacted_by?" do
    it "ユーザーが指定種類でリアクションしていればtrueを返す" do
      user = create(:user)
      comment = create(:comment)
      create(:comment_reaction, user: user, comment: comment, kind: :sorena)

      expect(comment.reacted_by?(user, :sorena)).to be true
      expect(comment.reacted_by?(user, :yonda)).to be false
    end

    it "他のユーザーのリアクションならfalseを返す" do
      user1 = create(:user)
      user2 = create(:user)
      comment = create(:comment)
      create(:comment_reaction, user: user1, comment: comment, kind: :sorena)

      expect(comment.reacted_by?(user2, :sorena)).to be false
    end
  end
end
