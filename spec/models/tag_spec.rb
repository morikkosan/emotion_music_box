require 'rails_helper'

RSpec.describe Tag, type: :model do
  # バリデーションのテスト
  describe "バリデーション" do
    subject { build(:tag) }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_length_of(:name).is_at_most(10) }

    # ★★ 自分で書くシンプルな uniqueness テスト ★★
    it "同じ name は保存できない" do
      # 1つ目を保存
      create(:tag, name: "tag1")

      # 同じ名前でもう1つ作る
      duplicate = build(:tag, name: "tag1")

      # 重複なので無効であることを確認
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:name]).to include("はすでに存在します").or include("has already been taken")
    end

    it do
      is_expected.to allow_value("タグ123", "tag", "テストタグ").for(:name)
    end

    it do
      is_expected.not_to allow_value("タグ!!", "bad*tag", "タグ＠", "タグ タグ").for(:name)
    end
  end

  # アソシエーションのテスト
  describe "アソシエーション" do
    it { is_expected.to have_many(:emotion_log_tags).dependent(:destroy) }
    it { is_expected.to have_many(:emotion_logs).through(:emotion_log_tags) }
  end
end
