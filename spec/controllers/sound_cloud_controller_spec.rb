require 'rails_helper'

RSpec.describe SoundCloudController, type: :controller do
  include Devise::Test::ControllerHelpers
  let(:user) { create(:user) }

  describe "GET #resolve" do
    let(:test_url) { "https://soundcloud.com/xxxx/yyy" }
    let(:fake_token) { "abc123" }

    before do
      sign_in user # ←これ必須
      stub_request(:post, "https://api.soundcloud.com/oauth2/token")
        .to_return(status: 200, body: { access_token: fake_token }.to_json, headers: { "Content-Type" => "application/json" })
      stub_request(:get, "https://api.soundcloud.com/resolve")
        .with(query: hash_including(url: test_url), headers: { "Authorization" => "OAuth #{fake_token}" })
        .to_return(status: 200, body: { id: "track_1", title: "Test Track" }.to_json, headers: { "Content-Type" => "application/json" })
    end

    it "200と正しいJSONを返す" do
      get :resolve, params: { url: test_url }, format: :json
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["id"]).to eq("track_1")
    end
  end
end
