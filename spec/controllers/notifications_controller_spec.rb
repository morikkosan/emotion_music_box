# frozen_string_literal: true
require "rails_helper"

RSpec.describe NotificationsController, type: :controller do
  include Devise::Test::ControllerHelpers

  # ★ これが無いと controller spec はビューを描画しない → body が空になる
  render_views

  let(:user) { create(:user, push_enabled: false) }

  around do |example|
    orig_pub  = ENV["VAPID_PUBLIC_KEY"]
    orig_priv = ENV["VAPID_PRIVATE_KEY"]
    begin
      example.run
    ensure
      ENV["VAPID_PUBLIC_KEY"]  = orig_pub
      ENV["VAPID_PRIVATE_KEY"] = orig_priv
    end
  end

  before do
    @request.env["devise.mapping"] = Devise.mappings[:user]
    sign_in user
  end

  # =========================
  # GET /notifications/test
  # =========================
  describe "GET #test" do
    context "プッシュ購読情報がある場合" do
      before do
        create(:push_subscription, user: user)
        ENV["VAPID_PUBLIC_KEY"]  = "test_public_key"
        ENV["VAPID_PRIVATE_KEY"] = "test_private_key"
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
      it "通知を送信せず、422＋メッセージを返す" do
        get :test, params: { id: user.id }
        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.body).to eq("No subscription")
      end
    end
  end

  # =========================
  # GET /notifications/public_key
  # =========================
  describe "GET #public_key" do
    context "VAPID公開鍵が設定されている場合" do
      before { ENV["VAPID_PUBLIC_KEY"] = "test_public_key" }

      it "200で鍵を返す" do
        get :public_key
        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json["publicKey"]).to eq("test_public_key")
      end
    end

    context "VAPID公開鍵が未設定の場合" do
      before { ENV["VAPID_PUBLIC_KEY"] = nil }

      it "204 No Content を返す" do
        get :public_key
        expect(response).to have_http_status(:no_content)
        expect(response.body).to be_blank
      end
    end
  end

  # =========================
  # PATCH /notifications/enable, /notifications/disable
  # =========================
  describe "PATCH toggle push (render_toggle)" do
    context "Turbo Stream" do
      it "enable: push_enabled を true にし、デスクトップ2ターゲットを置換" do
        patch :enable, format: :turbo_stream
        expect(response).to have_http_status(:ok)
        expect(response.media_type).to eq("text/vnd.turbo-stream.html")
        expect(response.body).to include('turbo-stream action="replace"')
        expect(response.body).to include('target="notification-push-toggle-desktop"')
        expect(response.body).to include('target="notification-toggle-desktop"')
        expect(user.reload.push_enabled).to be true
      end

      it "disable: push_enabled を false にし、デスクトップ2ターゲットを置換" do
        user.update!(push_enabled: true)
        patch :disable, format: :turbo_stream
        expect(response).to have_http_status(:ok)
        expect(response.media_type).to eq("text/vnd.turbo-stream.html")
        expect(response.body).to include('turbo-stream action="replace"')
        expect(response.body).to include('target="notification-push-toggle-desktop"')
        expect(response.body).to include('target="notification-toggle-desktop"')
        expect(user.reload.push_enabled).to be false
      end
    end

    context "HTML fallback" do
      it "enable: リダイレクトで戻る" do
        @request.env["HTTP_REFERER"] = root_path
        patch :enable
        expect(response).to have_http_status(:found)
        expect(response).to redirect_to(root_path)
        expect(user.reload.push_enabled).to be true
      end

      it "disable: リダイレクトで戻る" do
        user.update!(push_enabled: true)
        @request.env["HTTP_REFERER"] = root_path
        patch :disable
        expect(response).to have_http_status(:found)
        expect(response).to redirect_to(root_path)
        expect(user.reload.push_enabled).to be false
      end
    end
  end

  # =========================
  # GET /notifications/unread_count.json
  # =========================
  describe "GET #unread_count" do
    it "未読件数を返す" do
      3.times { Notification.create!(user: user, kind: "generic", title: "u", body: "u") }
      2.times { Notification.create!(user: user, kind: "generic", title: "r", body: "r", read_at: Time.current) }

      get :unread_count, format: :json
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["unread_count"]).to eq(3)
    end
  end

  # =========================
  # GET /notifications
  # =========================
  describe "GET #index" do
    it "未読があれば一括で既読化する" do
      already = Notification.create!(user: user, kind: "generic", title: "r1", body: "r1", read_at: Time.current)
      unread3 = 3.times.map { |i| Notification.create!(user: user, kind: "generic", title: "u#{i}", body: "u#{i}") }

      get :index # format: :html
      expect(response).to have_http_status(:ok)

      unread3.each { |n| expect(n.reload.read_at).to be_present }
      expect(already.reload.read_at).to be_present
    end
  end

  # =========================
  # POST /notifications/:id/read
  # =========================
  describe "POST #read" do
    it "個別通知を既読化して200" do
      n = Notification.create!(user: user, kind: "generic", title: "x", body: "x")
      post :read, params: { id: n.id }
      expect(response).to have_http_status(:ok)
      expect(n.reload.read_at).to be_present
    end
  end

  # =========================
  # POST /notifications/read_all
  # =========================
  describe "POST #read_all" do
    it "すべての未読を既読化して200" do
      a = Notification.create!(user: user, kind: "generic", title: "a", body: "a")
      b = Notification.create!(user: user, kind: "generic", title: "b", body: "b")
      post :read_all
      expect(response).to have_http_status(:ok)
      expect(a.reload.read_at).to be_present
      expect(b.reload.read_at).to be_present
    end
  end

  # =========================
  # GET /notifications/modal（turbo_stream）
  # =========================
  describe "GET #modal" do
    it "Turbo Stream を返す" do
      get :modal, format: :turbo_stream
      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("text/vnd.turbo-stream.html")
      expect(response.body).to include("<turbo-stream")
    end
  end

  # =========================
  # GET /notifications/modal_page?page=N
  # =========================
  describe "GET #modal_page" do
    before do
      25.times do |i|
        Notification.create!(
          user: user, kind: "generic",
          title: "n#{i}", body: "n#{i}",
          created_at: Time.current + i.seconds
        )
      end
    end

    it "page=1 は最新10件を返し、その10件のみ既読化（他は未読のまま）" do
      get :modal_page, params: { page: 1 }, format: :html # ← 明示
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("<turbo-frame") # layout: false のビュー本体

      recent_10 = user.notifications.order(created_at: :desc).limit(10).to_a
      recent_10.each { |n| expect(n.reload.read_at).to be_present }

      remain_15 = user.notifications.order(created_at: :desc).offset(10).limit(15).to_a
      remain_15.each { |n| expect(n.reload.read_at).to be_nil }
    end

    it "page=2 は次の10件を既読化し、page=1の10件は既に既読のまま" do
      get :modal_page, params: { page: 1 }, format: :html
      get :modal_page, params: { page: 2 }, format: :html
      expect(response).to have_http_status(:ok)

      page1_ids = user.notifications.order(created_at: :desc).limit(10).pluck(:id)
      page2_ids = user.notifications.order(created_at: :desc).offset(10).limit(10).pluck(:id)
      rest_ids  = user.notifications.order(created_at: :desc).offset(20).pluck(:id)

      page1_ids.each { |id| expect(Notification.find(id).read_at).to be_present }
      page2_ids.each { |id| expect(Notification.find(id).read_at).to be_present }
      rest_ids.each  { |id| expect(Notification.find(id).read_at).to be_nil }
    end

    it "30件制限を超えても既読化は表示分の10件だけ" do
      10.times do |i|
        Notification.create!(
          user: user, kind: "generic",
          title: "x#{i}", body: "x#{i}",
          created_at: Time.current + 1000 + i
        )
      end
      expect(user.notifications.count).to eq(35)

      get :modal_page, params: { page: 3 }, format: :html
      expect(response).to have_http_status(:ok)

      page3_ids   = user.notifications.order(created_at: :desc).limit(30).offset(20).limit(10).pluck(:id)
      outside_ids = user.notifications.order(created_at: :desc).offset(30).pluck(:id)

      page3_ids.each   { |id| expect(Notification.find(id).read_at).to be_present }
      outside_ids.each { |id| expect(Notification.find(id).read_at).to be_nil }
    end
  end
end
