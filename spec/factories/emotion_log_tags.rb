FactoryBot.define do
  factory :emotion_log_tag do
    association :emotion_log
    association :tag
  end
end
