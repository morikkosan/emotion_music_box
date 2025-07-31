# spec/environment_spec.rb
RSpec.describe "Rails環境確認" do
  it "必ずテスト環境で動いていること" do
    puts "== RAILS_ENV: #{Rails.env} =="
    expect(Rails.env.test?).to be true
  end
end
