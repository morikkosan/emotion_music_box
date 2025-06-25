class CreateLineLinkTokens < ActiveRecord::Migration[7.2]
  def change
    create_table :line_link_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.string :token
      t.boolean :used
      t.string :line_user_id

      t.timestamps
    end
  end
end
