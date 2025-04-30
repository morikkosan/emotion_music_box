class SetDefaultUserIdOnEmotionLogs < ActiveRecord::Migration[7.2]
  def up
    # 既存の User がいなければ、パスワード要件を満たすユーザーを作成
    user = User.first || User.create!(
      email: "default@example.com",
      password: "Password1",          # 大文字・小文字・数字を含む
      password_confirmation: "Password1"
    )

    # NULL の user_id を全て、このユーザーのIDで埋める
    EmotionLog.where(user_id: nil).update_all(user_id: user.id)

    # NOT NULL 制約を適用する
    change_column_null :emotion_logs, :user_id, false
  end

  def down
    change_column_null :emotion_logs, :user_id, true
  end
end
