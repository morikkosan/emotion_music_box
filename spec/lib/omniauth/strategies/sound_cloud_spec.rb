require 'rails_helper'
require_relative '../../../../lib/omniauth/strategies/sound_cloud'


RSpec.describe OmniAuth::Strategies::SoundCloud do
  let(:access_token) { instance_double("OAuth2::AccessToken") }
  let(:strategy) { described_class.new(nil, {}) }

  before do
    allow(strategy).to receive(:access_token).and_return(access_token)
    allow(access_token).to receive(:get)
      .with("/me")
      .and_return(double(parsed: { "id" => "user_id", "username" => "ユーザー名", "avatar_url" => "img_url" }))
  end

  describe "#uid" do
    it "returns id from raw_info" do
      expect(strategy.uid).to eq("user_id")
    end
  end

  describe "#info" do
    it "returns user info hash" do
      expect(strategy.info).to eq({ name: "ユーザー名", image: "img_url" })
    end
  end
end
