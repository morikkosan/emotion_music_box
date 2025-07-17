FactoryBot.define do
  factory :comment do
    association :user
    association :emotion_log
    content { "テストコメント" }
  end
end
