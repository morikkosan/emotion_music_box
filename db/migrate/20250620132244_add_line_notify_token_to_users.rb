class AddLineNotifyTokenToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :line_notify_token, :string
  end
end
