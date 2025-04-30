class AddSoundcloudDetailsToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :soundcloud_token, :string
    add_column :users, :soundcloud_refresh_token, :string
    add_column :users, :soundcloud_token_expires_at, :datetime
  end
end
