require 'rails_helper'

RSpec.describe Identity, type: :model do
  describe "validations" do
    it "is invalid with duplicate uid scoped to provider" do
      FactoryBot.create(:identity, uid: "alphaABC", provider: "soundcloud")
      dup = FactoryBot.build(:identity, uid: "alphaABC", provider: "soundcloud")

      dup.valid? # ✅ ← ここが必要！

      expect(dup).to be_invalid
      expect(dup.errors[:uid]).to include("はすでに存在します") # 日本語でOK
    end
  end
end
