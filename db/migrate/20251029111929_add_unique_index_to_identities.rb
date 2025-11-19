# frozen_string_literal: true

class AddUniqueIndexToIdentities < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def up
    # すでに同名インデックスがあれば何もしない（再実行しても安全）
    unless index_exists?(:identities, [ :provider, :uid ], name: "index_identities_on_provider_and_uid", unique: true)
      add_index :identities, [ :provider, :uid ],
                unique: true,
                name: "index_identities_on_provider_and_uid",
                algorithm: :concurrently
    end
  end

  def down
    remove_index :identities, name: "index_identities_on_provider_and_uid", algorithm: :concurrently
  end
end
