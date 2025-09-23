RSpec.describe DebugController, type: :controller do
  describe "GET #session_info" do
    context "production環境の場合" do
      before { allow(Rails.env).to receive(:production?).and_return(true) }

      it "404 Not Foundを返す" do
        get :session_info
        expect(response).to have_http_status(:not_found)  # ← 403 → 404 に修正
      end
    end

    context "production以外の場合" do
      let(:user) { create(:user) }

      before do
        allow(Rails.env).to receive(:production?).and_return(false)
        sign_in user
      end

      it "session情報を返す" do
        get :session_info
        expect(response).to have_http_status(:success)

        json = JSON.parse(response.body)
        expect(json).to have_key("session_state")
        expect(json).to have_key("user_session_key_present")
      end
    end
  end
end
