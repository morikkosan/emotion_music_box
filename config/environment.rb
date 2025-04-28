# Load the Rails application.
require_relative "application"

# Initialize the Rails application.
Rails.application.initialize!

if ENV["SESSION_SECRET"]
  require "openssl"
  cipher = OpenSSL::Cipher::AES.new(128, :CBC)
  cipher.encrypt
  cipher.key = Digest::SHA256.digest(ENV["SESSION_SECRET"])[0, 16]
end
