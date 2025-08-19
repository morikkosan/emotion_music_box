# spec/requests/pages_spec.rb
require "rails_helper"

RSpec.describe "Static pages", type: :request do
  it "GET /terms returns 200" do
    get terms_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Emotion Music Box 利用規約")
  end

  it "GET /privacy returns 200" do
    get privacy_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("プライバシーポリシー")
  end

  it "GET /cookie returns 200" do
    get cookie_policy_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Cookieポリシー")
  end
end
