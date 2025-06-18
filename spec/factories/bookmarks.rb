FactoryBot.define do
  factory :bookmark do
    association :user
    association :emotion_log
  end
end
