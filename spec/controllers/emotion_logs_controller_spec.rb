require 'rails_helper'

RSpec.describe EmotionLogsController, type: :controller do
  let(:user) { create(:user) }
  let!(:log1) { create(:emotion_log, emotion: "最高") }
  let!(:log2) { create(:emotion_log, emotion: "イライラ") }

  describe "GET #index" do
    context "未ログイン" do
      it "成功レスポンスを返す" do
        get :index
        expect(response).to have_http_status(:success)
      end

      it "@user_bookmark_idsが空" do
        get :index
        expect(assigns(:user_bookmark_ids)).to eq([])
      end

      it "絞り込み（emotion）が反映される" do
        get :index, params: { emotion: "最高" }
        expect(assigns(:emotion_logs)).to include(log1)
        expect(assigns(:emotion_logs)).not_to include(log2)
      end

      it "mobileパラメータでmobile_indexを描画" do
        get :index, params: { view: "mobile" }
        expect(response).to render_template(:mobile_index)
      end
    end

    context "ログイン" do
      before do
        sign_in user
        create(:bookmark, user: user, emotion_log: log1)
      end

      it "自分のブックマークIDがセットされる" do
        get :index
        expect(assigns(:user_bookmark_ids)).to include(log1.id)
      end
    end
  end

  describe "GET #my_emotion_logs" do
    before { sign_in user }

    it "マイページ用ログ一覧が取得できる" do
      my_log = create(:emotion_log, user: user)
      get :my_emotion_logs
      expect(assigns(:emotion_logs)).to include(my_log)
      expect(assigns(:mypage_title)).to eq("👮マイページ👮")
    end

    it "mobileビューを描画できる" do
      get :my_emotion_logs, params: { view: "mobile" }
      expect(response).to render_template(:mobile_index)
    end
  end

  describe "GET #show" do
    it "指定したEmotionLogが取得できる" do
      get :show, params: { id: log1.id }
      expect(assigns(:emotion_log)).to eq(log1)
      expect(response).to have_http_status(:success)
    end
  end

  describe "GET #new" do
    context "未ログイン" do
      it "ログインページにリダイレクト" do
        get :new
        expect(response).to redirect_to(new_user_session_path)
      end
    end

    context "HTMLリクエスト（ログイン済み）" do
      before { sign_in user }

      it "空テンプレで200OK" do
        get :new, params: { format: :html }
        expect(response).to have_http_status(:success)
      end
    end

    context "Turbo Stream（ログイン済み）" do
      before { sign_in user }

      it "Turbo Streamで新規作成フォームを表示" do
        get :new, params: { format: :turbo_stream }
        expect(response.media_type).to eq("text/vnd.turbo-stream.html")
        expect(assigns(:emotion_log)).to be_a_new(EmotionLog)
      end
    end
  end

  describe "POST #create" do
    before { sign_in user }

    context "有効なパラメータ" do
      it "新しいEmotionLogを作成できる" do
        expect {
          post :create, params: { emotion_log: attributes_for(:emotion_log) }
        }.to change { EmotionLog.count }.by(1)
      end

      it "HTMLリクエストでリダイレクト" do
        post :create, params: { emotion_log: attributes_for(:emotion_log) }
        expect(response).to redirect_to(emotion_logs_path)
      end

      it "JSONリクエストで成功レスポンス" do
        post :create, params: { emotion_log: attributes_for(:emotion_log) }, as: :json
        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body)["success"]).to eq(true)
      end
    end

    context "無効なパラメータ" do
      it "作成失敗で:unprocessable_entity" do
        post :create, params: { emotion_log: attributes_for(:emotion_log, emotion: nil) }
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe "GET #edit" do
    let(:own_log) { create(:emotion_log, user: user) }
    let(:other_log) { create(:emotion_log) }

    context "編集本人" do
      before { sign_in user }
      it "Turbo Streamで編集フォームを表示" do
        get :edit, params: { id: own_log.id, format: :turbo_stream }
        expect(response.media_type).to eq("text/vnd.turbo-stream.html")
        expect(assigns(:emotion_log)).to eq(own_log)
      end

      it "HTMLリクエストでは空テンプレで200OK" do
        get :edit, params: { id: own_log.id, format: :html }
        expect(response).to have_http_status(:success)
      end
    end

    context "オーナー以外" do
      before { sign_in user }
      it "forbiddenを返す" do
        get :edit, params: { id: other_log.id }
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "PATCH #update" do
    let(:own_log) { create(:emotion_log, user: user, emotion: "最高") }
    before { sign_in user }

    it "内容を更新できる" do
      patch :update, params: { id: own_log.id, emotion_log: { emotion: "イライラ" } }
      expect(own_log.reload.emotion).to eq("イライラ")
    end

    it "バリデーションエラーで:unprocessable_entity" do
      patch :update, params: { id: own_log.id, emotion_log: { emotion: nil } }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "DELETE #destroy" do
    let!(:own_log) { create(:emotion_log, user: user) }
    before { sign_in user }

    it "投稿を削除できる" do
      expect {
        delete :destroy, params: { id: own_log.id }
      }.to change { EmotionLog.count }.by(-1)
    end
  end

  describe "GET #form" do
    before { sign_in user }

    it "turbo_streamの場合は部分描画" do
      get :form, params: { format: :turbo_stream }
      expect(response.media_type).to eq("text/vnd.turbo-stream.html")
    end

    it "htmlの場合はリダイレクト" do
      get :form, params: { format: :html }
      expect(response).to redirect_to(emotion_logs_path)
    end
  end

  describe "GET #form_switch" do
    before { sign_in user }
    it "turbo_streamでフォーム切り替え" do
      get :form_switch, params: { format: :turbo_stream }
      expect(response.media_type).to eq("text/vnd.turbo-stream.html")
    end
  end

  describe "GET #bookmarks" do
    before { sign_in user }
    let!(:bookmark_log) { create(:emotion_log) }
    let!(:bookmark) { create(:bookmark, user: user, emotion_log: bookmark_log) }

    it "自分のブックマークした投稿が取得できる" do
      get :bookmarks
      expect(assigns(:emotion_logs)).to include(bookmark_log)
    end

    it "お気に入りがない場合はリダイレクト" do
      Bookmark.destroy_all
      get :bookmarks
      expect(response).to redirect_to(emotion_logs_path)
    end
  end

  describe "GET #recommended" do
    before { sign_in user }
    it "おすすめ投稿が取得できる" do
      get :recommended, params: { hp: 100 }
      expect(assigns(:emotion_logs)).to be_present
      expect(assigns(:recommended_page)).to eq("🔥おすすめ🔥")
    end
  end

  describe "ログインユーザーのトークンが期限切れのときはリフレッシュ処理が走る" do
  let(:expired_user) { create(:user, soundcloud_token_expires_at: 1.hour.ago) }

  before { sign_in expired_user }

  it "リフレッシュ処理が呼ばれる" do
    expect(SoundCloudClient).to receive(:refresh_token).with(expired_user).and_return(true)
    get :index
  end
end

end
