FactoryBot.define do
  factory :playlist do
    association :user
    name { "My Playlist" }
  end
end
