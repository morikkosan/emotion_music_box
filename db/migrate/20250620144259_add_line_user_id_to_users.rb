class AddLineUserIdToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :line_user_id, :string
  end
end
