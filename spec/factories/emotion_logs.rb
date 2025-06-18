# spec/factories/emotion_logs.rb
FactoryBot.define do
  factory :emotion_log do
    association :user  # user factoryで自動的に関連づく
    emotion { "気分良い" }
    description { "テスト投稿" }
    date { Date.today }
    music_url { "https://example.com/art.jpg" }
    track_name { "Test Song" }
    music_art_url { "https://example.com/art.jpg" }
  end
end

