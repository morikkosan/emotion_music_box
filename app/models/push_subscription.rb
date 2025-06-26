# app/models/push_subscription.rb
class PushSubscription < ApplicationRecord
  belongs_to :user
  validates :endpoint, :key_p256dh, :key_auth, presence: true
end
