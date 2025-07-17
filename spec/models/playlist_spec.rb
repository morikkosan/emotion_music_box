require 'rails_helper'

RSpec.describe Playlist, type: :model do
  let(:user) { create(:user) }
  let(:playlist) { create(:playlist, user: user) }

  it "有効なプレイリストを作成できる" do
    expect(playlist).to be_valid
    expect(playlist.name).to be_present
  end

  it "13個目のプレイリストは無効になる" do
+   12.times { create(:playlist, user: user) }

    extra_playlist = build(:playlist, user: user)
    expect(extra_playlist).not_to be_valid
    expect(extra_playlist.errors[:base]).to include("プレイリストは12個までしか作成できません")
  end
end