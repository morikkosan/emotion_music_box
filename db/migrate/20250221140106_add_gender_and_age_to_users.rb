class AddGenderAndAgeToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :gender, :string, null: true  # 性別はNULL許可（選択なしもOK）
    add_column :users, :age, :integer, null: true    # 年齢もNULL許可（未入力OK）
  end
end