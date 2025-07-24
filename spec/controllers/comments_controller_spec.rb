require 'rails_helper'

RSpec.describe CommentsController, type: :controller do
  # log_ownerはpush_subscription付きで作成（trait推奨だけど手動でもOK）
  let(:log_owner) { create(:user, name: '投稿者', push_enabled: true) }
  let!(:push_subscription) { create(:push_subscription, user: log_owner) }
  let(:commenter) { create(:user, name: 'コメン') }
  let(:emotion_log) { create(:emotion_log, user: log_owner) }

  before { sign_in commenter }

  describe "POST #create" do
    context "正しい値でコメント投稿した場合" do
      it "コメントが保存される" do
        expect {
          post :create, params: { emotion_log_id: emotion_log.id, body: "これはテストコメント" }, format: :turbo_stream
        }.to change(Comment, :count).by(1)
        comment = Comment.last
        expect(comment.body).to eq("これはテストコメント")
        expect(comment.user).to eq(commenter)
        expect(comment.emotion_log).to eq(emotion_log)
      end

      it "自分以外の投稿者なら通知処理が走る" do
        log_owner.reload
          puts "DEBUG enabled: #{log_owner.push_enabled?} sub: #{log_owner.push_subscription.present?}"

        emotion_log.reload
        expect(PushNotifier).to receive(:send_comment_notification)
        post :create, params: { emotion_log_id: emotion_log.id, body: "通知テスト" }, format: :turbo_stream
      end

      it "自分自身の投稿なら通知されない" do
        emotion_log.update(user: commenter) # ログ所有者＝自分
        log_owner.reload
        emotion_log.reload
        expect(PushNotifier).not_to receive(:send_comment_notification)
        post :create, params: { emotion_log_id: emotion_log.id, body: "通知なしテスト" }, format: :turbo_stream
      end
    end

    context "値が不正な場合" do
      it "コメントが保存されずリダイレクトされる" do
        expect {
          post :create, params: { emotion_log_id: emotion_log.id, body: "" }, format: :html
        }.not_to change(Comment, :count)
        expect(response).to redirect_to(emotion_log_path(emotion_log))
        expect(flash[:alert]).to eq "コメントの投稿に失敗しました"
      end
    end

    context "通知OFFの場合" do
      it "通知処理が呼ばれない" do
        log_owner.update!(push_enabled: false)
        log_owner.reload
        emotion_log.reload
        expect(PushNotifier).not_to receive(:send_comment_notification)
        post :create, params: { emotion_log_id: emotion_log.id, body: "通知OFFテスト" }, format: :turbo_stream
      end
    end
  end

  describe "PATCH #update" do
    let!(:comment) { create(:comment, user: commenter, emotion_log: emotion_log, body: "最初の本文") }

    it "自分のコメントを更新できる" do
      patch :update, params: { id: comment.id, comment: { body: "修正本文" } }, format: :turbo_stream
      comment.reload
      expect(comment.body).to eq "修正本文"
      expect(response.media_type).to eq "text/vnd.turbo-stream.html"
    end

    it "他人のコメントは更新できない" do
      comment.update(user: log_owner)
      patch :update, params: { id: comment.id, comment: { body: "不正な修正" } }
      expect(response).to have_http_status(:forbidden)
      expect(comment.reload.body).not_to eq "不正な修正"
    end
  end

  describe "DELETE #destroy" do
    let!(:comment) { create(:comment, user: commenter, emotion_log: emotion_log) }

    it "自分のコメントを削除できる" do
      expect {
        delete :destroy, params: { id: comment.id }, format: :turbo_stream
      }.to change(Comment, :count).by(-1)
      expect(response.media_type).to eq "text/vnd.turbo-stream.html"
    end

    it "他人のコメントは削除できない" do
      comment.update(user: log_owner)
      expect {
        delete :destroy, params: { id: comment.id }
      }.not_to change(Comment, :count)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST toggle_reaction" do
    let!(:comment) { create(:comment, user: log_owner, emotion_log: emotion_log) }

    it "リアクションを追加できる" do
      expect {
        post :toggle_reaction, params: { id: comment.id, kind: "sorena" }
      }.to change { comment.comment_reactions.count }.by(1)
      expect(JSON.parse(response.body)["action"]).to eq "added"
    end

    it "同じリアクションなら削除される" do
      comment.comment_reactions.create!(user: commenter, kind: :sorena)
      expect {
        post :toggle_reaction, params: { id: comment.id, kind: "sorena" }
      }.to change { comment.comment_reactions.count }.by(-1)
      expect(JSON.parse(response.body)["action"]).to eq "removed"
    end

    it "他人のコメントなら通知処理が走る" do
      expect(PushNotifier).to receive(:send_reaction_notification)
      post :toggle_reaction, params: { id: comment.id, kind: "sorena" }
    end
  end
end
