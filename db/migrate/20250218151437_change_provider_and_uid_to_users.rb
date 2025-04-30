class ChangeProviderAndUidToUsers < ActiveRecord::Migration[7.0]
  def change
    # ① NULLのところを仮の値で埋める（ここ追加する！）
    User.where(provider: nil).update_all(provider: 'dummy')
    User.where(uid: nil).update_all(uid: 'dummy')

    # ② そのあと NOT NULL 制約を付ける（これは今と同じ）
    change_column_null :users, :provider, false
    change_column_null :users, :uid, false
  end
end
