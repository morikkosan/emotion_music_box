RSpec.configure do |config|
  config.before(:each) do
    OmniAuth.config.test_mode = true
    OmniAuth.config.mock_auth[:soundcloud] = OmniAuth::AuthHash.new(
      {
        provider: 'soundcloud',
        uid: '123456',
        info: {
          nickname: 'fake_user',
          image: 'https://example.com/avatar.jpg'
        },
        credentials: {
          token: 'fake_token',
          refresh_token: 'fake_refresh_token',
          expires: true,
          expires_at: 1.hour.from_now.to_i
        }
      }.deep_symbolize_keys # ←ここ追加（重要）
    )
  end
end
