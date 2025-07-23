require 'rails_helper'

RSpec.describe BookmarksController, type: :controller do
  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:emotion_log) { create(:emotion_log, user: other_user) }

  before { sign_in user }

  describe "POST #create" do
    it "まだブックマークしていない投稿をブックマークできる" do
      expect {
        post :create, params: { emotion_log_id: emotion_log.id }
      }.to change { user.bookmarks.count }.by(1)
      expect(response).to have_http_status(:success).or have_http_status(:found)
    end

    it "すでにブックマークしている場合は増えない" do
      user.bookmarks.create!(emotion_log: emotion_log)
      expect {
        post :create, params: { emotion_log_id: emotion_log.id }
      }.not_to change { user.bookmarks.count }
    end

    it "Turbo Streamでレスポンスできる" do
      post :create, params: { emotion_log_id: emotion_log.id, format: :turbo_stream }
      expect(response.media_type).to eq("text/vnd.turbo-stream.html")
    end

    it "投稿者が自分以外かつPush購読ありなら通知送信" do
      create(:push_subscription, user: other_user)
      expect(PushNotifier).to receive(:send_bookmark_notification).with(
        other_user,
        by_user_name: user.name,
        track_name: emotion_log.track_name || "あなたの投稿"
      )
      post :create, params: { emotion_log_id: emotion_log.id }
    end

    it "投稿者が自分なら通知送らない" do
      own_log = create(:emotion_log, user: user)
      expect(PushNotifier).not_to receive(:send_bookmark_notification)
      post :create, params: { emotion_log_id: own_log.id }
    end
  end

  describe "DELETE #destroy" do
    let!(:bookmark) { user.bookmarks.create!(emotion_log: emotion_log) }

    it "自分のブックマークを解除できる" do
      expect {
        delete :destroy, params: { id: bookmark.id }
      }.to change { user.bookmarks.count }.by(-1)
      expect(response).to have_http_status(:success).or have_http_status(:found)
    end

    it "Turbo Streamでレスポンスできる" do
      delete :destroy, params: { id: bookmark.id, format: :turbo_stream }
      expect(response.media_type).to eq("text/vnd.turbo-stream.html")
    end
  end
end
