class CreateCommentReactions < ActiveRecord::Migration[7.2]
  def change
    create_table :comment_reactions do |t|
      t.integer :kind
      t.references :user, null: false, foreign_key: true
      t.references :comment, null: false, foreign_key: true

      t.timestamps
    end
  end
end
