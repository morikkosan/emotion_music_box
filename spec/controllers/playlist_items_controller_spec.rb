require 'rails_helper'

RSpec.describe PlaylistItemsController, type: :controller do
  render_views

  let(:user) { create(:user) }
  let!(:playlist) { create(:playlist, user: user) }
  let!(:emotion_log) { create(:emotion_log, user: user) }

  before { sign_in user }

  describe "POST #create" do
    context "正常に曲が追加される場合" do
      it "プレイリストに曲が追加され、Turbo Streamで部分テンプレートが返る" do
        request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"

        expect {
          post :create, params: {
            playlist_id: playlist.id,
            emotion_log_id: emotion_log.id
          }
        }.to change(PlaylistItem, :count).by(1)

        expect(response).to have_http_status(:success)
        expect(response.body).to include("addSongsModalBody")
      end
    end

    context "曲の追加に失敗する場合" do
      it "エラーメッセージが含まれる" do
        request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"

        post :create, params: {
          playlist_id: playlist.id,
          emotion_log_id: nil
        }

        expect(response.body).to include("曲の追加に失敗しました").or include("エラー")
      end
    end
  end

  describe "DELETE #destroy" do
    let!(:playlist_item) { create(:playlist_item, playlist: playlist, emotion_log: emotion_log) }

    it "曲がプレイリストから削除され、Turbo Streamで再描画される" do
      request.env["HTTP_ACCEPT"] = "text/vnd.turbo-stream.html"

      expect {
        delete :destroy, params: {
          playlist_id: playlist.id,
          id: playlist_item.id
        }
      }.to change(PlaylistItem, :count).by(-1)

      expect(response.body).to include("target=\"contents_playlist_")
      # もしくは↓
      # expect(response.body).to include("まだ曲が追加されていません。")
    end
  end

  describe "POST #create HTML形式" do
    context "失敗した場合はリダイレクトしてフラッシュ表示" do
      it "flashにエラーメッセージが設定される" do
        post :create, params: {
          playlist_id: playlist.id,
          emotion_log_id: nil
        }, format: :html

        expect(response).to redirect_to(playlist_path(playlist))
        expect(flash[:alert]).to match(/曲の追加に失敗しました/)
      end
    end
  end

  describe "DELETE #destroy HTML形式" do
    let!(:playlist_item) { create(:playlist_item, playlist: playlist, emotion_log: emotion_log) }

    it "削除後にリダイレクトされ、flashに通知が表示される" do
      delete :destroy, params: {
        playlist_id: playlist.id,
        id: playlist_item.id
      }, format: :html

      expect(response).to redirect_to(playlist_path(playlist))
      expect(flash[:notice]).to eq("曲をプレイリストから削除しました。")
      expect(PlaylistItem.exists?(playlist_item.id)).to be_falsey
    end
  end
end
