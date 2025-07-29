require 'rails_helper'

RSpec.describe "PushSubscriptions", type: :request do
  let(:user) { create(:user, :password_user) }

  let(:valid_subscription) do
    {
      endpoint: "https://example.com",
      keys: { p256dh: "dummy_p256dh", auth: "dummy_auth" }
    }
  end

  let(:headers) do
    { 'CONTENT_TYPE' => 'application/json', 'ACCEPT' => 'application/json' }
  end

  describe "POST /push_subscription" do
    context "ログインしている場合" do
      before { sign_in user }

      it "プッシュ購読情報を作成し、成功レスポンスを返す" do
        post push_subscription_path,
             params: { subscription: valid_subscription }.to_json,
             headers: headers

        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body)["success"]).to eq(true)
        expect(user.reload.push_subscription).to be_present
      end
    end

    context "ログインしていない場合" do
      it "401 Unauthorized または 403 Forbidden を返す" do
        post push_subscription_path,
             params: { subscription: valid_subscription }.to_json,
             headers: headers

        expect(response).to have_http_status(:unauthorized).or have_http_status(:forbidden)
      end
    end
  end
end
