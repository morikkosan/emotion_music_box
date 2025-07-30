RSpec.describe DebugController, type: :controller do
  describe "GET #session_info" do
    context "production環境の場合" do
      before { allow(Rails.env).to receive(:production?).and_return(true) }
      it "403 Forbiddenを返す" do
        get :session_info
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "production以外の場合" do
      before { allow(Rails.env).to receive(:production?).and_return(false) }
      it "session情報を返す" do
        get :session_info
        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json).to have_key("session_state")
        expect(json).to have_key("full_session")
      end
    end
  end
end
