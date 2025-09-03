# spec/mailers/contact_mailer_spec.rb
require "rails_helper"

RSpec.describe ContactMailer, type: :mailer do
  describe "#notify_admin" do
    context "問い合わせメールアドレスがある場合" do
      it "CONTACT_TO に送られ、from は RESEND_FROM、reply_to は問い合わせのメールになる" do
        contact = double("Contact", name: "テスト", message: "Hello!", email: "test@example.com")

        mail = described_class.with(contact: contact).notify_admin

        # 実装：to は ENV["CONTACT_TO"]（rails_helper で admin@example.test をセット済み）
        expect(mail.to).to eq([ENV.fetch("CONTACT_TO", "morikko0124@yahoo.co.jp")])

        # ApplicationMailer 由来（rails_helper で RESEND_FROM をセット済み）
        expect(mail.from).to eq([ENV.fetch("RESEND_FROM", "no-reply@example.test")])

        # email があれば reply_to はそれ
        expect(mail.reply_to).to eq(["test@example.com"])

        expect(mail.subject).to include("お問い合わせ")
        expect(mail.body.encoded).to include("test@example.com")
        expect(mail.body.encoded).to include("Hello!")
      end
    end

    context "問い合わせメールアドレスが空の場合" do
      it "reply_to は RESEND_REPLY_TO になる" do
        contact = double("Contact", name: "名無し", message: "内容", email: nil)

        mail = described_class.with(contact: contact).notify_admin

        expect(mail.to).to eq([ENV.fetch("CONTACT_TO", "morikko0124@yahoo.co.jp")])
        expect(mail.from).to eq([ENV.fetch("RESEND_FROM", "no-reply@example.test")])
        expect(mail.reply_to).to eq([ENV.fetch("RESEND_REPLY_TO", "support@example.test")])
      end
    end
  end
end
