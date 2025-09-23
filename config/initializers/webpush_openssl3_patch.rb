# OpenSSL 3.xでの "pkeys are immutable" エラーを回避するパッチ
require "web_push"
require "openssl"

if defined?(WebPush)
  begin
    if OpenSSL::PKey::EC.instance_methods.include?(:set_private_key)
      WebPush::Encryption.class_eval do
        alias_method :orig_generate_key, :generate_key

        def generate_key
          key = orig_generate_key
          key = OpenSSL::PKey::EC.new(key.to_der) # mutableなECキーを作り直す
          key
        end
      end
    end
  rescue => e
    Rails.logger.warn "[web_push_openssl3_patch] Patch failed: #{e.class} #{e.message}"
  end
end
