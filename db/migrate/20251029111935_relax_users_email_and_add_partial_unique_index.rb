# frozen_string_literal: true

class RelaxUsersEmailAndAddPartialUniqueIndex < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def up
    # 既存の email インデックス（ユニーク/非ユニーク問わず）を削除（存在すれば）
    remove_index :users, :email, algorithm: :concurrently rescue nil
    remove_index :users, name: "index_users_on_email", algorithm: :concurrently rescue nil

    # 空文字を NULL に統一（unique 部分インデックスの前提を整える）
    execute <<~SQL
      UPDATE users SET email = NULL WHERE email = '';
    SQL

    # email の NOT NULL と default を解除
    change_column_null :users, :email, true
    change_column_default :users, :email, nil

    # 部分ユニーク（email IS NOT NULL の行だけ、LOWER(email) で一意）
    unless index_exists?(:users, "lower(email)", name: "index_users_on_lower_email_not_null", unique: true, where: "email IS NOT NULL")
      execute <<~SQL
        CREATE UNIQUE INDEX CONCURRENTLY index_users_on_lower_email_not_null
        ON users (LOWER(email))
        WHERE email IS NOT NULL;
      SQL
    end
  end

  def down
    # 部分ユニークを削除
    execute <<~SQL
      DROP INDEX CONCURRENTLY IF EXISTS index_users_on_lower_email_not_null;
    SQL

    # 元の制約に戻す（NOT NULL + default '' + ユニーク）
    change_column_default :users, :email, ""
    change_column_null :users, :email, false

    add_index :users, :email, unique: true, algorithm: :concurrently
  end
end
