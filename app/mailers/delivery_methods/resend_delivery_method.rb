require "resend"
require "base64"

module DeliveryMethods
  class ResendDeliveryMethod
    def initialize(values)
      @settings = values
      Resend.api_key ||= ENV["RESEND_API_KEY"]
    end

    def deliver!(mail)
      from = (mail[:from]&.value.presence || ENV.fetch("RESEND_FROM"))
      # フィールドオブジェクトではなく、配列の文字列アドレスを使う
      to   = Array(mail.to)
      cc   = Array(mail.cc).presence
      bcc  = Array(mail.bcc).presence

      html = if mail.html_part
               mail.html_part.body.decoded
             elsif mail.content_type&.include?("html")
               mail.body.decoded
             end
      text = if mail.text_part
               mail.text_part.body.decoded
             elsif !html
               mail.body.decoded
             end

      headers = {}
      mail.header.fields.each do |f|
        next if %w[from to cc bcc subject content-type mime-version].include?(f.name.downcase)
        headers[f.name] = f.value.to_s
      end

      atts = mail.attachments.map do |att|
        {
          filename: att.filename,
          content:  Base64.strict_encode64(att.body.decoded),
          type:     att.mime_type
        }
      end

      # ✅ Ruby 3 でも確実に「位置引数1個(Hash)」として渡す
      payload = {
        from: from,
        to:   to,
        cc:   cc,
        bcc:  bcc,
        subject:  mail.subject.to_s,
        html:     html,
        text:     text
      }
      payload[:headers]     = headers if headers.present?
      payload[:attachments] = atts    if atts.present?

      Resend::Emails.send(payload)
    end
  end
end
