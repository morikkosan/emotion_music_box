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
      user.name = "あいうえおかき"
      expect(user).not_to be_valid
    end

    it "providerがないと無効になること" do
      user.provider = nil
      expect(user).not_to be_valid
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

it "profile_completedの初期値はfalseであること" do
  new_user = User.new
  expect(new_user.profile_completed).to be_falsey
end


  describe ".from_omniauth" do
    let(:auth_hash) do
      OmniAuth::AuthHash.new(
        provider: 'soundcloud',
        uid: '999999',
        info: {
          nickname: 'sound_user',
          image: 'https://example.com/avt.jpg'
        },
        credentials: {
          token: 'token_test',
          refresh_token: 'refresh_token_test',
          expires: true,
          expires_at: 2.hours.from_now.to_i
        }
      )
    end

    it "provider/uidが一致するユーザーを返す（既存ユーザーの場合）" do
      existing = create(:user, provider: 'soundcloud', uid: '999999')
      user = User.from_omniauth(auth_hash)
      expect(user).to eq(existing)
    end

    it "provider/uidが存在しない場合は新規ユーザーを作成する" do
      expect {
        User.from_omniauth(auth_hash)
      }.to change { User.count }.by(1)
    end

    it "取得したnickname, avatar_urlを保存すること" do
      user = User.from_omniauth(auth_hash)
      expect(user.name).to eq("sound_user")
      expect(user.avatar_url).to eq("https://example.com/avt.jpg")
    end
  end








  end