class AddSoundcloudUidToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :soundcloud_uid, :string
  end
end
