require 'rails_helper'

RSpec.describe CommentReaction, type: :model do
  describe "アソシエーション" do
    it { should belong_to(:user) }
    it { should belong_to(:comment) }
  end

  describe "バリデーション / enum" do
    it "kindは定義された種類のみ有効" do
      expect(CommentReaction.kinds.keys).to include("sorena", "yonda")
    end
  end
end
