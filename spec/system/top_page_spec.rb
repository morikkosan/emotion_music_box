require 'rails_helper'

RSpec.describe "トップページ", type: :system do
  it "表示できること" do
    visit "/"
    expect(page).to have_content("EMOTION")  # ←アプリに必ず表示される文字
  end
end
