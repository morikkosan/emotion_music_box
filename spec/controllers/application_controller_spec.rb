# spec/controllers/application_controller_spec.rb

RSpec.describe ApplicationController, type: :controller do
  controller do # ダミーコントローラー
    def index
      render plain: mobile_device?.to_s
    end
  end

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
