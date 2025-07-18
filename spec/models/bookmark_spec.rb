require 'rails_helper'

RSpec.describe Bookmark, type: :model do
  describe "アソシエーション" do
    it { should belong_to(:user) }
    it { should belong_to(:emotion_log) }
  end
end
