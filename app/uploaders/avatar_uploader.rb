# app/uploaders/avatar_uploader.rb
class AvatarUploader < CarrierWave::Uploader::Base
  include Cloudinary::CarrierWave
end
