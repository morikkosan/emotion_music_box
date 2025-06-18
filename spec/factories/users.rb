FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" 0 }
    password { "password" }
    name { "Test User" }
    uid { SecureRandom.hex(8) }
    provider { "sound_cloud" }
    profile_completed { true }
    gender { "other"}
    age { 20 }
  end
end


