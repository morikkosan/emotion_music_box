require 'rails_helper'

RSpec.describe PushSubscription, type: :model do
  # FactoryBotで user と push_subscription を作れる前提

  it "is valid with all required attributes" do
    subscription = build(:push_subscription)  # build ならDB保存せず、バリデーションだけ
    expect(subscription).to be_valid
  end

  it "is invalid without endpoint" do
    subscription = build(:push_subscription, endpoint: nil)
    expect(subscription).not_to be_valid
  end

  it "is invalid without key_p256dh" do
    subscription = build(:push_subscription, key_p256dh: nil)
    expect(subscription).not_to be_valid
  end

  it "is invalid without key_auth" do
    subscription = build(:push_subscription, key_auth: nil)
    expect(subscription).not_to be_valid
  end

  it "is invalid without user" do
    subscription = build(:push_subscription, user: nil)
    expect(subscription).not_to be_valid
  end
end
