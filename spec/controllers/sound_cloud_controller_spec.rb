require 'rails_helper'

RSpec.describe SoundCloudController, type: :controller do
  include Devise::Test::ControllerHelpers
  let(:user) { create(:user) }
  before { sign_in user }

  describe "GET #resolve" do
    let(:test_url) { "https://soundcloud.com/xxxx/yyy" }

    it "トークン取得失敗で400を返す" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return(nil)
      get :resolve, params: { url: test_url }, format: :json
      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)["error"]).to include("アプリ用トークン")
    end

    it "SoundCloud API失敗時にエラー返す" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return("token123")
      error_response = double(success?: false, code: 404, parsed_response: "Not Found")
      allow(HTTParty).to receive(:get).and_return(error_response)
      get :resolve, params: { url: test_url }, format: :json
      expect(response.status).to eq(404)
      expect(JSON.parse(response.body)["error"]).to eq("Not Found")
      expect(JSON.parse(response.body)["code"]).to eq(404)
    end

    it "例外が発生した場合も500を返す" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return("token123")
      allow(HTTParty).to receive(:get).and_raise("API爆発")
      get :resolve, params: { url: test_url }, format: :json
      expect(response.status).to eq(500)
      expect(JSON.parse(response.body)["error"]).to include("例外発生")
    end

    it "正常時は200でデータを返す（カバレッジ用）" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return("token123")
      success_response = double(success?: true, parsed_response: { "id" => "track_1", "title" => "Test Track" })
      allow(HTTParty).to receive(:get).and_return(success_response)
      get :resolve, params: { url: test_url }, format: :json
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["id"]).to eq("track_1")
    end
  end

  describe "POST #search" do
    it "トークン取得失敗で400を返す" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return(nil)
      post :search, params: { q: "relax" }, format: :json
      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)["error"]).to include("アプリ用トークン")
    end

    it "API失敗時にエラーを返す" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return("token")
      error_response = double(success?: false, code: 503, parsed_response: "api_error")
      allow(HTTParty).to receive(:get).and_return(error_response)
      post :search, params: { q: "relax" }, format: :json
      expect(response.status).to eq(503)
      json = JSON.parse(response.body)
      expect(json["error"]).to eq("SoundCloud APIエラー")
      expect(json["code"]).to eq(503)
      expect(json["body"]).to eq("api_error")
    end

    it "例外が発生した場合も500を返す" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return("token")
      allow(HTTParty).to receive(:get).and_raise(StandardError, "network error")
      post :search, params: { q: "relax" }, format: :json
      expect(response.status).to eq(500)
      expect(JSON.parse(response.body)["error"]).to include("例外発生")
    end

    it "正常時は200で配列を返す（カバレッジ用）" do
      allow_any_instance_of(SoundCloudController).to receive(:fetch_app_token).and_return("token")
      success_response = double(success?: true, parsed_response: [ { "id" => "track_1" }, { "id" => "track_2" } ])
      allow(HTTParty).to receive(:get).and_return(success_response)
      post :search, params: { q: "relax" }, format: :json
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json).to be_an(Array)
      expect(json.first["id"]).to eq("track_1")
    end
  end

  describe "#fetch_app_token" do
    it "HTTParty.post successならトークン返す" do
      success_res = double(success?: true, body: { access_token: "tokenX" }.to_json)
      allow(HTTParty).to receive(:post).and_return(success_res)
      expect(controller.send(:fetch_app_token)).to eq("tokenX")
    end

    it "HTTParty.post失敗時はnilを返す" do
      fail_res = double(success?: false, body: {}.to_json)
      allow(HTTParty).to receive(:post).and_return(fail_res)
      expect(controller.send(:fetch_app_token)).to eq(nil)
    end

    it "例外が発生したらnilを返す" do
      allow(HTTParty).to receive(:post).and_raise(StandardError, "爆発")
      expect(controller.send(:fetch_app_token)).to eq(nil)
    end
  end
end
