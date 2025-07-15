require "securerandom"

Capybara.register_driver :selenium_chrome_headless do |app|
  options = Selenium::WebDriver::Chrome::Options.new

  options.add_argument('--headless=new')
  options.add_argument('--disable-gpu')
  options.add_argument('--no-sandbox')
  options.add_argument('--disable-dev-shm-usage')
  options.add_argument('--ignore-certificate-errors')
  options.add_argument('--allow-insecure-localhost')

  # ここから追加
  options.add_argument('--allow-running-insecure-content')
  options.add_argument('--ignore-urlfetcher-cert-requests')
  # ここまで追加

  user_data_dir = "/tmp/chrome_user_data_#{SecureRandom.hex(10)}"
  options.add_argument("--user-data-dir=#{user_data_dir}")

  Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
end

Capybara.javascript_driver = :selenium_chrome_headless
Capybara.app_host = "https://moriappli-emotion.com"
Capybara.run_server = false
