FactoryBot.define do
  factory :comment do
    association :user
    association :emotion_log
    body { "テストコメント" }
  end
end
