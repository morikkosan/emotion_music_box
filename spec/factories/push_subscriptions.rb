FactoryBot.define do
  factory :push_subscription do
    association :user
    endpoint { "https://example.com/endpoint" }
    key_p256dh { "sample_key_p256dh" }
    key_auth { "sample_key_auth" }
  end
end
