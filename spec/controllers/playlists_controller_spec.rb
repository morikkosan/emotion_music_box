require 'rails_helper'

RSpec.describe PlaylistsController, type: :controller do
  render_views

  let(:user) { create(:user) }
  let!(:emotion_log1) { create(:emotion_log, user: user) }
  let!(:emotion_log2) { create(:emotion_log, user: user) }

  before { sign_in user }


  describe "GET #new" do
    it "Turbo Streamでモーダル部分テンプレートが返る" do
      request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"
      get :new
      expect(response.body).to include("playlist-modal-container")
    end
  end

  describe "POST #create 成功パターン" do
    it "正常にプレイリストが作成される" do
      request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"
      expect {
        post :create, params: {
          playlist: { name: "My Playlist" },
          selected_logs: [ emotion_log1.id, emotion_log2.id ]
        }
      }.to change(Playlist, :count).by(1)
       .and change(PlaylistItem, :count).by(2)

      expect(response.body).to include("プレイリストを作成しました")
    end
  end

  describe "POST #create 名前未入力" do
    it "バリデーションエラーになる" do
      request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"
      post :create, params: {
        playlist: { name: "" },
        selected_logs: [ emotion_log1.id ]
      }

      expect(response.body).to include("名前を入力してください").or include("エラー")
    end
  end

  describe "POST #create ログ未選択" do
    it "ログ未選択で警告表示される" do
      request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"
      post :create, params: {
        playlist: { name: "テスト" },
        selected_logs: []
      }

      expect(response.body).to include("チェックマークが1つも選択されていません")
    end
  end

  describe "GET #show" do
    let!(:playlist) { create(:playlist, user: user) }
    let!(:item) { create(:playlist_item, playlist: playlist, emotion_log: emotion_log1) }

    it "プレイリストの音楽URLが含まれる" do
      get :show, params: { id: playlist.id }
      expect(response.body).to include("data-play-url=\"#{emotion_log1.music_url}\"")
    end
  end

  describe "GET #show 存在しないID" do
    it "見つからない場合リダイレクトされる" do
      get :show, params: { id: "999999" }
      expect(response).to redirect_to(playlists_path)
    end
  end

  describe "DELETE #destroy" do
    let!(:playlist) { create(:playlist, user: user) }

    it "削除後にリダイレクトされる" do
      request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"
      delete :destroy, params: { id: playlist.id }

      expect(response.body).to include("プレイリストを削除しました")
      expect(Playlist.exists?(playlist.id)).to be_falsey
    end
  end
end
