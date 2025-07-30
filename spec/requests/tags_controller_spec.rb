# spec/requests/tags_controller_spec.rb
require 'rails_helper'

RSpec.describe "Tags", type: :request do
  describe "GET /tags" do
    let!(:tag1) { Tag.create!(name: "rock") }
    let!(:tag2) { Tag.create!(name: "pop") }

    it "qがあると部分一致で返す" do
      get "/tags", params: { q: "ro" }
      expect(response).to have_http_status(:success)
      expect(JSON.parse(response.body)).to eq(["rock"])
    end

    it "qが無いと空配列" do
      get "/tags"
      expect(response).to have_http_status(:success)
      expect(JSON.parse(response.body)).to eq([])
    end
  end

  describe "GET /tags/search" do
    let!(:tag1) { Tag.create!(name: "rock") }
    let!(:tag2) { Tag.create!(name: "pop") }

    it "qで部分一致した名前のハッシュが返る" do
      get "/tags/search", params: { q: "po" }
      expect(response).to have_http_status(:success)
      result = JSON.parse(response.body)
      # "name" が "pop" である要素が含まれていることだけを確認
      expect(result.any? { |r| r["name"] == "pop" }).to be true
      # 必ず "id" キーも存在することを確認
      expect(result.first).to have_key("id")
      expect(result.first).to have_key("name")
    end
  end
end
