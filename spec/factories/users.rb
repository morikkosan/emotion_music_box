FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "dummy#{n}@example.com" }  # ←これ追加
    uid { SecureRandom.hex(8) }
    provider { "soundcloud" }   # ← "sound_cloud" → "soundcloud" に合わせて（from_omniauthの値に揃える）
    profile_completed { true }
    gender { "other" }
    age { 20 }
    name { "太郎" }
    avatar_url { "/images/default_stick_figure.webp" }

    trait :with_unique_name do
      sequence(:name) { |n| ("u#{n}")[0...6] }
    end
  end
end
