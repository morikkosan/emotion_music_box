# spec/support/webmock_stub.rb

require 'webmock/rspec'

RSpec.configure do |config|
  config.before(:each) do
    stub_request(:get, /soundcloud.com\/oembed/)
      .to_return(
        status: 200,
        body: {
          thumbnail_url: "https://example.com/fake_image.jpg",
          title: "Fake Track Title",
          author_name: "Fake Artist"
        }.to_json,
        headers: { 'Content-Type' => 'application/json' }
      )
  end
end
