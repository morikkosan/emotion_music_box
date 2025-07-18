require 'rails_helper'

RSpec.describe Playlist, type: :model do
  let(:user) { create(:user) }
  let(:playlist) { create(:playlist, user: user) }

  describe "バリデーション" do
    it "有効なプレイリストを作成できる" do
      expect(playlist).to be_valid
      expect(playlist.name).to be_present
    end

    it "13個目のプレイリストは無効になる" do
      12.times { create(:playlist, user: user) }

      extra_playlist = build(:playlist, user: user)
      expect(extra_playlist).not_to be_valid
      expect(extra_playlist.errors[:base]).to include("プレイリストは12個までしか作成できません")
    end

    it "名前が空だと無効になる" do
      invalid_playlist = build(:playlist, user: user, name: nil)
      expect(invalid_playlist).to be_invalid
      expect(invalid_playlist.errors[:name]).to include("を入力してください")
    end

    it "名前が15文字を超えると無効になる" do
      long_name_playlist = build(:playlist, user: user, name: "あ" * 16)
      expect(long_name_playlist).to be_invalid
      expect(long_name_playlist.errors[:name]).to include("は15文字以内で入力してください")
    end
  end

  describe "アソシエーション" do
    it { should belong_to(:user) }
    it { should have_many(:playlist_items).dependent(:destroy) }
    it { should have_many(:emotion_logs).through(:playlist_items) }
  end
end
