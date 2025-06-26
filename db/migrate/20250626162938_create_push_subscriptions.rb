class CreatePushSubscriptions < ActiveRecord::Migration[7.2]
  def change
    create_table :push_subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.text :endpoint
      t.string :key_p256dh
      t.string :key_auth

      t.timestamps
    end
  end
end
