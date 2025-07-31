require 'rails_helper'

RSpec.describe BookmarksController, type: :controller do
  let!(:user)         { create(:user, :password_user) }
  let!(:other_user)   { create(:user, :password_user) }
  let!(:emotion_log)  { create(:emotion_log, user: other_user) }

  before { sign_in user }

  describe "POST #create" do
    context "他人の投稿・push購読あり" do
      before do
        allow_any_instance_of(User).to receive(:push_subscription).and_return(double("PushSubscription", present?: true))
        allow(PushNotifier).to receive(:send_bookmark_notification)
      end

      it "push通知が送られる" do
        post :create, params: { emotion_log_id: emotion_log.id }
        expect(PushNotifier).to have_received(:send_bookmark_notification).with(
          emotion_log.user,
          by_user_name: user.name,
          track_name: emotion_log.track_name || "あなたの投稿"
        )
        expect(response).to have_http_status(:found) # or :success for turbo_stream
      end
    end

    context "自分の投稿" do
      let!(:own_log) { create(:emotion_log, user: user) }

      it "push通知は送られない" do
        expect(PushNotifier).not_to receive(:send_bookmark_notification)
        post :create, params: { emotion_log_id: own_log.id }
      end
    end
  end

  describe "DELETE #destroy" do
    let!(:bookmark) { user.bookmarks.create!(emotion_log: emotion_log) }

    it "正常に削除できる" do
      expect {
        delete :destroy, params: { id: bookmark.id }
      }.to change { Bookmark.count }.by(-1)
      expect(response).to redirect_to(emotion_logs_path)
    end
  end

  describe "POST #toggle" do
    context "ブックマーク済みの場合は解除" do
      let!(:bookmark) { user.bookmarks.create!(emotion_log: emotion_log) }

      it "解除される" do
        expect {
          post :toggle, params: { emotion_log_id: emotion_log.id }
        }.to change { Bookmark.count }.by(-1)
      end
    end

    context "未ブックマークの場合は作成され通知も送信" do
      before do
        allow_any_instance_of(User).to receive(:push_subscription).and_return(double("PushSubscription", present?: true))
        allow(PushNotifier).to receive(:send_bookmark_notification)
      end

      it "作成され通知も送信される" do
        expect {
          post :toggle, params: { emotion_log_id: emotion_log.id }
        }.to change { Bookmark.count }.by(1)
        expect(PushNotifier).to have_received(:send_bookmark_notification)
      end
    end
  end
end
