FactoryBot.define do
  factory :identity do
    provider { "soundcloud" }
    sequence(:uid) { |n| "uidAlpha#{n}" } # ← 英字を入れておくと安全
    association :user
  end
end
