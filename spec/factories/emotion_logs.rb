# spec/factories/emotion_logs.rb
FactoryBot.define do
  factory :emotion_log do
    association :user
    emotion { "気分良い" }
    description { "テスト投稿" }
    date { Date.today }
    music_url { "https://soundcloud.com/example-track" }
    track_name { "Test Song" }
    music_art_url { "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg" }

    trait :with_tags do
      tag_names { "happy, fun" }
    end
  end
end
