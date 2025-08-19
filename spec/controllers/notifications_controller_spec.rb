require 'rails_helper'
require 'web-push'

RSpec.describe NotificationsController, type: :controller do
  let(:user) { create(:user) }

  # Deviseのマッピング＋ログインを各ケースで使えるように
  before do
    @request.env['devise.mapping'] = Devise.mappings[:user]
  end

  describe "GET #test" do
    context "プッシュ購読情報がある場合" do
      before do
        sign_in user
        create(:push_subscription, user: user)
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

      it "通知を送信せず、メッセージを返す" do
        get :test, params: { id: user.id }
        expect(response).to have_http_status(:success)
        expect(response.body).to eq("No subscription")
      end
    end
  end

  describe "GET #public_key" do
    before do
      ENV['VAPID_PUBLIC_KEY'] = 'test_public_key'
      sign_in user
    end

    it "VAPID公開鍵を返す" do
      get :public_key
      json = JSON.parse(response.body)
      expect(response).to have_http_status(:success)
      expect(json["publicKey"]).to eq("test_public_key")
    end
  end
end
