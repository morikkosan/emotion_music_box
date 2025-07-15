require  'rails_helper'

RSpec.describe User, type: :model do

  let(:user) { create(:user) }

    it "有効なファクトリーユーザーが有効になること"  do
      expect(user).to be_valid
    end

    it "名前が未入力でも無効になること" do
      user.name = nil
      expect(user).not_to be_valid
    end

    it "ログイン後、名前が6文字以内であること" do

      
    end

    it "uid(sound_cloud)がないと無効になること" do
      user.uid = nil
      expect(user).not_to be_valid
    end

    it "パスワードがなくても有効" do
  user = build(:user, password: nil)
  expect(user).to be_valid
  end

  it "avatar_urlがあればそれを返す" do
  user = build(:user, avatar_url: "example.png")
  expect(user.profile_avatar_url).to eq("example.png")
end

it "avatar_urlがなければデフォルト画像を返す" do
  user = build(:user, avatar_url: nil)
  expect(user.profile_avatar_url).to eq("default_stick_figure.webp")
end







  end