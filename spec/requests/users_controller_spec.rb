require 'rails_helper'

RSpec.describe "Users", type: :request do
  let!(:user) { create(:user, :password_user) }

  before { sign_in user }

  it "通知をONにできる" do
    patch enable_push_notifications_path
    expect(user.reload.push_enabled).to eq(true)
  end

  it "通知をOFFにできる" do
    patch disable_push_notifications_path
    expect(user.reload.push_enabled).to eq(false)
  end
end
