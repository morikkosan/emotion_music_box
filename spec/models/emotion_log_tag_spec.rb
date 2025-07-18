# spec/models/emotion_log_tag_spec.rb
require 'rails_helper'

RSpec.describe EmotionLogTag, type: :model do
  describe 'associations' do
    it { should belong_to(:emotion_log) }
    it { should belong_to(:tag) }
  end
end
