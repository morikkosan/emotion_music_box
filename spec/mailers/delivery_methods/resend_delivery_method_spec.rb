# frozen_string_literal: true
require "rails_helper"
require "mail"

RSpec.describe DeliveryMethods::ResendDeliveryMethod do
  let(:delivery) { described_class.new({}) }

  before do
    # Resend 呼び出しは必ずモック化（外部通信しない）
    allow(Resend::Emails).to receive(:send).and_return({ "id" => "test_123" })
  end

  describe "#deliver!" do
    context "ENVのRESEND_FROMを使う（from未指定）かつ text/plain 単体" do
      it "payload を正しく構築して Resend::Emails.send を呼ぶ" do
        # ENV['RESEND_FROM'] を安全にスタブ
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("RESEND_FROM").and_return("noreply@example.com")

        mail = Mail.new do
          to       "to1@example.com"
          subject  "Hello Plain"
          content_type "text/plain"
          body     "plain body"
        end

        delivery.deliver!(mail)

        expect(Resend::Emails).to have_received(:send) do |payload|
          expect(payload[:from]).to eq("noreply@example.com")
          expect(payload[:to]).to eq(["to1@example.com"]) # array_or_nil
          expect(payload[:cc]).to be_nil                   # compact で消えている
          expect(payload[:bcc]).to be_nil
          expect(payload[:reply_to]).to be_nil
          expect(payload[:subject]).to eq("Hello Plain")
          expect(payload[:text]).to eq("plain body")
          expect(payload[:html]).to be_nil
        end
      end
    end

    context "multipart（text + html）の本文抽出" do
      it "text_part / html_part をそれぞれ抽出して送る" do
        mail = Mail.new
        mail[:to]       = "to2@example.com"
        mail[:from]     = "from@example.com"
        mail[:subject]  = "Hello Multipart"

        mail.text_part = Mail::Part.new do
          content_type "text/plain; charset=UTF-8"
          body "TEXT PART"
        end

        mail.html_part = Mail::Part.new do
          content_type "text/html; charset=UTF-8"
          body "<p>HTML PART</p>"
        end

        delivery.deliver!(mail)

        expect(Resend::Emails).to have_received(:send) do |payload|
          expect(payload[:from]).to eq("from@example.com")
          expect(payload[:to]).to eq(["to2@example.com"])
          expect(payload[:text]).to eq("TEXT PART")
          expect(payload[:html]).to eq("<p>HTML PART</p>")
        end
      end
    end

    context "to/cc/bcc の配列化と reply_to の先頭採用" do
      it "to は配列のまま、bcc は文字列→配列化、reply_to は先頭のみ" do
        mail = Mail.new do
          from      "from2@example.com"
          to        ["a@example.com", "b@example.com"]
          cc        ["cc1@example.com"]
          bcc       "blind@example.com"
          reply_to  ["reply1@example.com", "reply2@example.com"]
          subject   "Array Case"
          content_type "text/plain"
          body      "hi"
        end

        delivery.deliver!(mail)

        expect(Resend::Emails).to have_received(:send) do |payload|
          expect(payload[:from]).to eq("from2@example.com")
          expect(payload[:to]).to eq(["a@example.com", "b@example.com"])
          expect(payload[:cc]).to eq(["cc1@example.com"])
          expect(payload[:bcc]).to eq(["blind@example.com"]) # 文字列→配列化
          expect(payload[:reply_to]).to eq("reply1@example.com") # 先頭だけ
          expect(payload[:subject]).to eq("Array Case")
          expect(payload[:text]).to eq("hi")
        end
      end
    end

    context "compact による nil キーの除去" do
      it "未設定のキーは payload に含めない（:cc/:bcc/:html など）" do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("RESEND_FROM").and_return("from3@example.com")

        mail = Mail.new do
          to        "only_to@example.com"
          subject   "Compact"
          content_type "text/plain"
          body      "text-only"
        end

        delivery.deliver!(mail)

        expect(Resend::Emails).to have_received(:send) do |payload|
          expect(payload.keys).to include(:from, :to, :subject, :text)
          expect(payload.keys).not_to include(:cc)
          expect(payload.keys).not_to include(:bcc)
          expect(payload.keys).not_to include(:html)
        end
      end
    end
  end
end
