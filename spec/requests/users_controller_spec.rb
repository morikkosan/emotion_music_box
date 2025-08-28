# spec/requests/users_controller_spec.rb
require 'rails_helper'

RSpec.describe "Users", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:user) { create(:user, :password_user, push_enabled: false) }

  before { sign_in user }

  describe "HTML フォールバック" do
    it "通知をONにできる（HTML）" do
      headers = { "HTTP_REFERER" => root_path } # redirect_back 用
      patch enable_push_notifications_path, headers: headers

      expect(response).to have_http_status(:found)
      expect(response).to redirect_to(root_path)
      # NOTE: request spec 直後に flash を読むのは brittle なので検証しない
      expect(user.reload.push_enabled).to eq(true)
    end

    it "通知をOFFにできる（HTML）" do
      user.update!(push_enabled: true)
      headers = { "HTTP_REFERER" => root_path }
      patch disable_push_notifications_path, headers: headers

      expect(response).to have_http_status(:found)
      expect(response).to redirect_to(root_path)
      # NOTE: 同上（flash検証はしない）
      expect(user.reload.push_enabled).to eq(false)
    end
  end

  describe "Turbo Stream" do
    it "通知をONにできる（Turbo Stream）" do
      headers = { "ACCEPT" => "text/vnd.turbo-stream.html" }
      patch enable_push_notifications_path, headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("text/vnd.turbo-stream.html")

      # 2つのターゲット（desktop / mobile）に対する置換が含まれることを検証
      expect(response.body).to include('turbo-stream action="replace"')
      expect(response.body).to include('target="notification-toggle-desktop"')
      expect(response.body).to include('target="notification-toggle-mobile"')

      expect(user.reload.push_enabled).to eq(true)
    end

    it "通知をOFFにできる（Turbo Stream）" do
      user.update!(push_enabled: true)
      headers = { "ACCEPT" => "text/vnd.turbo-stream.html" }
      patch disable_push_notifications_path, headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("text/vnd.turbo-stream.html")

      expect(response.body).to include('turbo-stream action="replace"')
      expect(response.body).to include('target="notification-toggle-desktop"')
      expect(response.body).to include('target="notification-toggle-mobile"')

      expect(user.reload.push_enabled).to eq(false)
    end
  end

  describe "認可" do
    it "未ログインだと enable はサインインへリダイレクト" do
      sign_out user
      patch enable_push_notifications_path
      expect(response).to have_http_status(:found)
      expect(response).to redirect_to(new_user_session_path)
    end

    it "未ログインだと disable はサインインへリダイレクト" do
      sign_out user
      patch disable_push_notifications_path
      expect(response).to have_http_status(:found)
      expect(response).to redirect_to(new_user_session_path)
    end
  end
end
