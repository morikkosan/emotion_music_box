FactoryBot.define do
  factory :playlist do
    association :user
    sequence(:name) { |n| "プレイリスト#{n}" }  # 例: プレイリスト1, プレイリスト2...
  end
end
