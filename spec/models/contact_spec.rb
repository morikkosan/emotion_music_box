# spec/models/contact_spec.rb
require 'rails_helper'

RSpec.describe Contact, type: :model do
  describe "バリデーション" do
    it "全ての項目が正しければ有効である" do
      contact = Contact.new(name: "太郎", email: "taro@example.com", message: "お問い合わせ内容です")
      expect(contact).to be_valid
    end

    it "名前が空なら無効" do
      contact = Contact.new(name: "", email: "taro@example.com", message: "こんにちは")
      expect(contact).not_to be_valid
      expect(contact.errors[:name]).to include("を入力してください")
    end

    it "名前が2文字未満なら無効" do
      contact = Contact.new(name: "あ", email: "taro@example.com", message: "こんにちは")
      expect(contact).not_to be_valid
    end

    it "名前が11文字以上なら無効" do
      contact = Contact.new(name: "あ" * 11, email: "taro@example.com", message: "こんにちは")
      expect(contact).not_to be_valid
    end

    it "メールが不正な形式なら無効" do
      contact = Contact.new(name: "太郎", email: "invalid_email", message: "こんにちは")
      expect(contact).not_to be_valid
      expect(contact.errors[:email]).to include("は不正な値です")
    end

    it "メッセージが空なら無効" do
      contact = Contact.new(name: "太郎", email: "taro@example.com", message: "")
      expect(contact).not_to be_valid
    end

    it "メッセージが5文字未満なら無効" do
      contact = Contact.new(name: "太郎", email: "taro@example.com", message: "短い")
      expect(contact).not_to be_valid
    end

    it "メッセージが201文字以上なら無効" do
      contact = Contact.new(name: "太郎", email: "taro@example.com", message: "あ" * 201)
      expect(contact).not_to be_valid
    end
  end

  describe "#persisted?" do
    it "falseを返すこと" do
      contact = Contact.new
      expect(contact.persisted?).to eq(false)
    end
  end
end
