FactoryBot.define do
  factory :playlist_item do
    association :playlist
    association :emotion_log
  end
end
