# spec/controllers/api_rate_limitable_spec.rb
require "rails_helper"

RSpec.describe ApiRateLimitable, type: :controller do
  #
  # 匿名コントローラ（テスト専用のダミーコントローラ）
  #
  controller(ApplicationController) do
    include ApiRateLimitable

    def stream
      enforce_stream_limit!
      render json: { ok: true } unless performed?
    end

    def search
      enforce_search_limit!
      render json: { ok: true } unless performed?
    end
  end

  #
  # ApiRequestLimiter をモックに差し替える
  #
  let(:limiter) { instance_double(ApiRequestLimiter) }

  before do
    # ★ このテスト専用のルーティングを定義する（anonymous#stream / #search）
    routes.draw do
      get "stream" => "anonymous#stream"
      get "search" => "anonymous#search"
    end

    # ApiRequestLimiter.new(session) をモックにする
    allow(ApiRequestLimiter).to receive(:new).and_return(limiter)
  end

  # ======================================
  # stream (再生API) のテスト
  # ======================================
  describe "#enforce_stream_limit!" do
    context "allowed が true の場合" do
      it "通常レスポンスを返す（200 OK）" do
        allow(limiter).to receive(:allow_stream_request!).and_return(true)

        get :stream, format: :json

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body["ok"]).to eq(true)
      end
    end

    context "allowed が false の場合" do
      it "429 とエラーメッセージを返す" do
        allow(limiter).to receive(:allow_stream_request!).and_return(false)

        get :stream, format: :json

        expect(response).to have_http_status(:too_many_requests)
        body = JSON.parse(response.body)
        expect(body["error"]).to include("再生リクエスト上限")
      end
    end
  end

  # ======================================
  # search (検索API) のテスト
  # ======================================
  describe "#enforce_search_limit!" do
    context "allowed が true の場合" do
      it "通常レスポンスを返す（200 OK）" do
        allow(limiter).to receive(:allow_search_request!).and_return(true)

        get :search, format: :json

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body["ok"]).to eq(true)
      end
    end

    context "allowed が false の場合" do
      it "429 とエラーメッセージを返す" do
        allow(limiter).to receive(:allow_search_request!).and_return(false)

        get :search, format: :json

        expect(response).to have_http_status(:too_many_requests)
        body = JSON.parse(response.body)
        expect(body["error"]).to include("検索リクエストの上限")
      end
    end
  end
end
