require 'rails_helper'

RSpec.describe News, type: :model do
  describe 'smoke' do
    it 'is defined and inherits from ApplicationRecord' do
      # モデルが存在して ActiveRecord を継承していることだけを確認（壊れにくい）
      expect(News < ApplicationRecord).to be true
    end
  end
end
