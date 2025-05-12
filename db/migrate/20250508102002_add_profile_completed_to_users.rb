# db/migrate/xxxxxxxxxx_add_profile_completed_to_users.rb
class AddProfileCompletedToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :profile_completed, :boolean, default: false, null: false
  end
end
