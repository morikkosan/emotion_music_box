class AddDefaultToUsersProvider < ActiveRecord::Migration[7.0]
  def change
    change_column_default :users, :provider, "email"
  end
end
