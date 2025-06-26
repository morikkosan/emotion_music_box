# db/migrate/xxx_add_push_enabled_to_users.rb
class AddPushEnabledToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :push_enabled, :boolean, default: true
  end
end
