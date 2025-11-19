# db/migrate/20251031_create_notifications.rb
class CreateNotifications < ActiveRecord::Migration[7.2]
  def change
    create_table :notifications do |t|
      t.references :user, null: false, foreign_key: true

      # enum は文字列で保存（model側で enum kind: {...} を文字列マッピングにしているため）
      t.string  :kind,  null: false, default: "generic"

      # 表示用の見出し＋本文
      t.string  :title, null: false, default: ""
      t.text    :body

      # 関連先を開くURL（通知から該当ページへ飛ばす用途）
      t.string  :url

      # 既読化の印
      t.datetime :read_at

      t.timestamps
    end

    # 未読数カウント最適化（/notifications/unread_count.json 用）
    add_index :notifications, [ :user_id, :read_at ]

    # 一覧の新着順を速く
    add_index :notifications, :created_at
  end
end
