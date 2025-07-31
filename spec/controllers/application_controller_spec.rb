# spec/controllers/application_controller_spec.rb
require 'rails_helper'

RSpec.describe ApplicationController, type: :controller do
  controller do
    def index
      render plain: mobile_device?.to_s
    end

    def test_after_omniauth_failure
      redirect_to after_omniauth_failure_path_for(:user)
    end

    def test_after_sign_in_path
      render plain: after_sign_in_path_for(:user)
    end

    def test_chart_data
      chart_data
    end
  end

  before do
    routes.draw do
      get 'index' => 'anonymous#index'
      get 'test_after_omniauth_failure' => 'anonymous#test_after_omniauth_failure'
      get 'test_after_sign_in_path' => 'anonymous#test_after_sign_in_path'
      get 'test_chart_data' => 'anonymous#test_chart_data'
    end
  end

  describe "mobile_device?" do
    it "iPhoneのuser_agentでtrueになる" do
      request.user_agent = "iPhone"
      get :index
      expect(response.body).to eq("true")
    end

    it "Androidのuser_agentでtrueになる" do
      request.user_agent = "Android"
      get :index
      expect(response.body).to eq("true")
    end

    it "普通のPCでfalseになる" do
      request.user_agent = "Windows"
      get :index
      expect(response.body).to eq("false")
    end
  end

  describe "after_omniauth_failure_path_for" do
    it "フラッシュとリダイレクト" do
      get :test_after_omniauth_failure
      expect(flash[:alert]).to include("SoundCloudログインがキャンセル")
      expect(response).to redirect_to(root_path)
    end
  end

  describe "after_sign_in_path_for" do
    it "emotion_logs_pathを返す" do
      get :test_after_sign_in_path
      expect(response.body).to eq(emotion_logs_path)
    end
  end

  describe "chart_data" do
  let!(:user) { create(:user) }
  let!(:emotion_log) do
    EmotionLog.create!(
  user: user,
  date: Date.today,
  description: "テスト",
  music_url: "https://soundcloud.com/test",
  emotion: "最高"
)

  end

  it "jsonが返る" do
    get :test_chart_data, format: :json
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to be_a(Hash)
  end
end



end
