class PlaylistItem < ApplicationRecord
  belongs_to :playlist
  belongs_to :emotion_log
end
