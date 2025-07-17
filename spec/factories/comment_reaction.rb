FactoryBot.define do
  factory :comment_reaction do
    association :user
    association :comment
    kind { :sorena }
  end
end
