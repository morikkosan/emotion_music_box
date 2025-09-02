# /app/mailers/delivery_methods/resend_delivery_method.rb
require "resend"
require "base64"

module DeliveryMethods
  class ResendDeliveryMethod
    # settings は今は未使用だが将来拡張用に受け取っておく
    def initialize(values); @settings = values; end

    def deliver!(mail)
      from_addr   = (mail[:from]&.decoded.presence) || ENV["RESEND_FROM"]
      to_addrs    = array_or_nil(mail.to)
      cc_addrs    = array_or_nil(mail.cc)
      bcc_addrs   = array_or_nil(mail.bcc)
      reply_to    = array_or_nil(mail.reply_to)&.first

      # 本文は text/html を適切に抽出（どちらかだけでもOK）
      html_body = if mail.html_part
                    mail.html_part.body.to_s
                  elsif (mail.content_type || "").include?("text/html")
                    mail.body.decoded
                  end

      text_body = if mail.text_part
                    mail.text_part.body.to_s
                  elsif (mail.content_type || "").include?("text/plain")
                    mail.body.decoded
                  end

      # いったん添付なし（必要になったら下のコメントを参考に実装）
      payload = {
        from:    from_addr,
        to:      to_addrs,
        cc:      cc_addrs,
        bcc:     bcc_addrs,
        subject: mail.subject.to_s,
        reply_to: reply_to,
        html:    html_body,
        text:    text_body,
        # headers: mail.header.fields.map { |f| [f.name, f.value] }.to_h, # 任意
        # attachments: build_attachments(mail) # 任意（後述）
      }.compact

      Rails.logger.info("[Resend] sending: to=#{Array(to_addrs).join(",")} subject=#{mail.subject}")

      Resend::Emails.send(payload) # 成功時は { id: "..." } を返す
    end

    private

    def array_or_nil(v)
      return nil if v.blank?
      v.is_a?(Array) ? v : [v.to_s]
    end

    # 添付が必要なときは、以下のように base64 化して渡します
    # Resend の仕様に合わせて :filename と :content(Base64) を積む形でOK
    #
    # def build_attachments(mail)
    #   return nil if mail.attachments.blank?
    #   mail.attachments.map do |att|
    #     {
    #       filename: att.filename.to_s,
    #       content:  Base64.strict_encode64(att.body.to_s)
    #     }
    #   end
    # end
  end
end
