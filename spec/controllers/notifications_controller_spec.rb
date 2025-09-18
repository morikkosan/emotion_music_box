RSpec.describe NotificationsController, type: :controller do
  let(:user) { create(:user) }

  around do |example|
    orig_pub  = ENV['VAPID_PUBLIC_KEY']
    orig_priv = ENV['VAPID_PRIVATE_KEY']
    begin
      example.run
    ensure
      ENV['VAPID_PUBLIC_KEY']  = orig_pub
      ENV['VAPID_PRIVATE_KEY'] = orig_priv
    end
  end

  before do
    @request.env['devise.mapping'] = Devise.mappings[:user]
  end

  describe "GET #test" do
    context "プッシュ購読情報がある場合" do
      before do
        sign_in user
        create(:push_subscription, user: user)
        # ここでキーを用意（send_webpush がショートサーキットしないように）
        ENV['VAPID_PUBLIC_KEY']  = 'test_public_key'
        ENV['VAPID_PRIVATE_KEY'] = 'test_private_key'
        allow(WebPush).to receive(:payload_send).and_return(true)
      end

      it "通知を送信して成功レスポンスを返す" do
        get :test, params: { id: user.id }
        expect(response).to have_http_status(:success)
        expect(response.body).to eq("通知送信しました")
        expect(WebPush).to have_received(:payload_send)
      end
    end

    context "プッシュ購読情報がない場合" do
      before { sign_in user }

      it "通知を送信せず、422＋メッセージを返す" do
        get :test, params: { id: user.id }
        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.body).to eq("No subscription")
      end
    end
  end

  describe "GET #public_key" do
    before { sign_in user }

    context "VAPID公開鍵が設定されている場合" do
      before { ENV['VAPID_PUBLIC_KEY'] = 'test_public_key' }

      it "200で鍵を返す" do
        get :public_key
        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body)["publicKey"]).to eq("test_public_key")
      end
    end

    context "VAPID公開鍵が未設定の場合" do
      before { ENV['VAPID_PUBLIC_KEY'] = nil }

      it "204 No Content を返す" do
        get :public_key
        expect(response).to have_http_status(:no_content)
        expect(response.body).to be_blank
      end
    end
  end
end
