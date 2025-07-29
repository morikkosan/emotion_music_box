FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "dummy#{n}@example.com" }
    uid { SecureRandom.hex(8) }
    provider { "soundcloud" }
    profile_completed { true }
    gender { "other" }
    age { 20 }
    name { "太郎" }
    avatar_url { "/images/default_stick_figure.webp" }
    password { "password" }
    password_confirmation { "password" }

    # テスト用パスワードユーザー
    trait :password_user do
      provider { "test" }   # ← nilにしない！
      uid { "test_uid" }
    end
  end
end
