class AddReactionsCountToComments < ActiveRecord::Migration[7.0]
  def change
    add_column :comments, :reactions_count, :integer, null: false, default: 0
  end
end
