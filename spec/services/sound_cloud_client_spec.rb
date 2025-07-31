require 'rails_helper'

RSpec.describe SoundCloudClient do
  describe ".refresh_token" do
    let(:user) { create(:user, :password_user, soundcloud_refresh_token: "dummy_token") }

    context "成功時" do
      it "トークンを更新してtrueを返す" do
        success_response = double("HTTParty::Response",
          code: 200,
          parsed_response: {
            "access_token" => "new_token",
            "refresh_token" => "new_refresh",
            "expires_in" => 3600
          }
        )
        allow(HTTParty).to receive(:post).and_return(success_response)

        expect(SoundCloudClient.refresh_token(user)).to eq(true)
        expect(user.reload.soundcloud_token).to eq("new_token")
        expect(user.reload.soundcloud_refresh_token).to eq("new_refresh")
      end
    end

    context "失敗時" do
      it "falseを返す" do
        error_response = double("HTTParty::Response",
          code: 400,
          parsed_response: {},
          body: "invalid_grant"
        )
        allow(HTTParty).to receive(:post).and_return(error_response)

        expect(SoundCloudClient.refresh_token(user)).to eq(false)
      end
    end
  end
end
