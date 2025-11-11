# frozen_string_literal: true
require "rails_helper"

RSpec.describe ApplicationController, type: :controller do
  # ApplicationController を継承した匿名コントローラ
  controller do
    # 認証の動作確認用 before_action
    before_action :require_auth, only: [:protected_json, :protected_html]

    def index
      # refresh_soundcloud_token_if_needed / set_locale が before_action で走る
      render plain: mobile_device?.to_s
    end

    def protected_json
      respond_to do |format|
        format.json { render json: { ok: true } }
        format.html { render plain: "NG" }
      end
    end

    def protected_html
      render plain: "html ok"
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

    private

    def require_auth
      # ApplicationController の authenticate_user! を直接呼ぶ
      authenticate_user!
    end
  end

  before do
    # ルーティング
    routes.draw do
      get  "index"                       => "anonymous#index"
      get  "test_after_omniauth_failure" => "anonymous#test_after_omniauth_failure"
      get  "test_after_sign_in_path"     => "anonymous#test_after_sign_in_path"
      get  "test_chart_data"             => "anonymous#test_chart_data"
      get  "protected_html"              => "anonymous#protected_html"
      get  "protected_json"              => "anonymous#protected_json", defaults: { format: :json }

      # Devise ログインページを最小限に
      get  "/users/sign_in", to: "devise/sessions#new", as: :new_user_session
    end

    # Devise マッピング
    @request.env["devise.mapping"] = Devise.mappings[:user]
  end

  describe "mobile_device?" do
    it "iPhone の UA で true" do
      request.user_agent = "iPhone"
      get :index
      expect(response.body).to eq("true")
    end

    it "Android の UA で true" do
      request.user_agent = "Android"
      get :index
      expect(response.body).to eq("true")
    end

    it "PC っぽい UA で false" do
      request.user_agent = "Windows"
      get :index
      expect(response.body).to eq("false")
    end
  end

  describe "after_omniauth_failure_path_for" do
    it "フラッシュとルートへリダイレクト" do
      get :test_after_omniauth_failure
      expect(flash[:alert]).to include("SoundCloudログインがキャンセル")
      expect(response).to redirect_to(root_path)
    end
  end

  describe "after_sign_in_path_for" do
    it "emotion_logs_path を返す" do
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

    it "JSON が返る" do
      get :test_chart_data, format: :json
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to be_a(Hash)
    end
  end

  describe "set_locale" do
    it "常に :ja がセットされる" do
      get :index
      expect(I18n.locale).to eq(:ja)
    end
  end

  describe "authenticate_user!" do
    let(:user) { create(:user) }

    context "未ログイン & JSON リクエスト" do
      it "401 JSON を返す" do
        get :protected_json, format: :json
        expect(response).to have_http_status(:unauthorized)
        data = JSON.parse(response.body)
        expect(data["error"]).to eq("Unauthorized")
      end
    end

    context "未ログイン & HTML リクエスト" do
      it "ログインページへリダイレクト" do
        get :protected_html
        expect(response).to have_http_status(:found)
        expect(response).to redirect_to(new_user_session_path)
      end
    end

    context "ログイン済み" do
      it "super(**opts) 経由で通過（200）" do
        sign_in user
        get :protected_html
        expect(response).to have_http_status(:ok)
        expect(response.body).to eq("html ok")
      end
    end
  end

  describe "refresh_soundcloud_token_if_needed" do
    let(:user) { create(:user) }

    it "未ログインなら何もしない（200）" do
      get :index
      expect(response).to have_http_status(:ok)
    end

    context "ログイン済み" do
      before { sign_in user }

      it "expires_at が無ければ何もしない" do
        user.update!(soundcloud_token_expires_at: nil)
        expect(SoundCloudClient).not_to receive(:refresh_token)
        get :index
        expect(response).to have_http_status(:ok)
      end

      it "期限内なら何もしない" do
        user.update!(soundcloud_token_expires_at: 1.hour.from_now)
        expect(SoundCloudClient).not_to receive(:refresh_token)
        get :index
        expect(response).to have_http_status(:ok)
      end

      it "期限切れ & リフレッシュ成功なら 200" do
        user.update!(soundcloud_token_expires_at: 1.hour.ago)
        allow(SoundCloudClient).to receive(:refresh_token).with(user).and_return(true)
        get :index
        expect(response).to have_http_status(:ok)
      end

      it "期限切れ & リフレッシュ失敗なら sign_out + ログインへリダイレクト" do
        user.update!(soundcloud_token_expires_at: 1.hour.ago)
        allow(SoundCloudClient).to receive(:refresh_token).with(user).and_return(false)
        get :index
        expect(response).to have_http_status(:found)
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end
end
