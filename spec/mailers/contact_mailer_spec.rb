require "rails_helper"

RSpec.describe ContactMailer, type: :mailer do
  it "管理者宛てメールを生成する" do
    contact = double("Contact", name: "テスト", message: "Hello!", email: "test@example.com")
    mail = described_class.with(contact: contact).notify_admin
    expect(mail.to).to eq(["morikko0124@gmail.com"])
    expect(mail.subject).to include("お問い合わせ")
    expect(mail.body.encoded).to include("test@example.com")  # オプション: メール本文にも含まれることを確認
  end
end
