# spec/models/user_spec.rb
require 'rails_helper'

RSpec.describe User, type: :model do
  # データの重複対策: テスト前に関連テーブル全削除
  before(:each) do
    Notification.delete_all
    Bookmark.delete_all        # Userに依存 →先に消す
    CommentReaction.delete_all
    Comment.delete_all
    PlaylistItem.delete_all
    Playlist.delete_all
    EmotionLogTag.delete_all
    Tag.delete_all
    EmotionLog.delete_all
    Identity.delete_all
    PushSubscription.delete_all
    User.delete_all            # 最後にUser
  end

  let(:user) { create(:user) }

  it "有効なファクトリーユーザーが有効になること" do
    expect(user).to be_valid
  end

  it "名前が未入力なら無効になること" do
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
    expected = ActionController::Base.helpers.asset_path("default_stick_figure.webp")
    expect(user.profile_avatar_url).to eq(expected)
  end

  it "profile_completedの初期値はfalseであること" do
    # ※ カラムが存在しない場合はこのテストは削除してください
    new_user = User.new
    expect(new_user.profile_completed).to be_falsey
  end

  describe ".from_omniauth" do
    let(:auth_hash) do
      OmniAuth::AuthHash.new(
        provider: 'soundcloud',
        uid: '999999',
        info: {
          name: 'sound_user',
          email: '999999@soundcloud.com',  # ←ここは必須
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
      # email/uid/providerが一致する既存userを先に作る
      existing = create(:user,
                        provider: 'soundcloud',
                        uid: '999999',
                        email: '999999@soundcloud.com',
                        name: '手動名') # ← プロバ名と違う手動名にしておく
      user = User.from_omniauth(auth_hash)
      expect(user.id).to eq(existing.id)
    end

    it "既存ユーザーでは手動で設定した name を上書きしない" do
      # 既存ユーザーの手動名（6文字以内、プロバ名の 'sound_' と違う値）
      existing = create(:user,
                        provider: 'soundcloud',
                        uid: '999999',
                        email: '999999@soundcloud.com',
                        name: '手動名')

      # プロバイダからは 'sound_user' が来る（6文字トリムで 'sound_'）
      User.from_omniauth(auth_hash)

      expect(existing.reload.name).to eq('手動名')
    end

    it "provider/uidが存在しない場合は新規ユーザーを作成する" do
      expect {
        User.from_omniauth(auth_hash)
      }.to change { User.count }.by(1)
    end

    it "初回作成時はプロバイダ名（6文字にトリム）を user.name に採用する" do
      user = User.from_omniauth(auth_hash)
      expect(user.name).to eq("sound_")  # 'sound_user'[0,6]
      expect(user.avatar_url).to be_nil  # 現仕様ならnil
    end
  end
end
