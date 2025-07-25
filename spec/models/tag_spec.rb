require 'rails_helper'

RSpec.describe Tag, type: :model do
  # バリデーションのテスト
  describe "バリデーション" do
    subject { build(:tag) }

    it { should validate_presence_of(:name) }
    it { should validate_uniqueness_of(:name) }
    it { should validate_length_of(:name).is_at_most(10) }
    it {
      should allow_value("タグ123", "tag", "テストタグ").for(:name)
    }
    it {
      should_not allow_value("タグ!!", "bad*tag", "タグ＠", "タグ タグ").for(:name)
    }
  end

  # アソシエーションのテスト
  describe "アソシエーション" do
    it { should have_many(:emotion_log_tags).dependent(:destroy) }
    it { should have_many(:emotion_logs).through(:emotion_log_tags) }
  end
end
