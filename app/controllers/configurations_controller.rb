class ConfigurationsController < ApplicationController
  def soundcloud_client_id
    render json: { client_id: ENV["SOUNDCLOUD_CLIENT_ID"] }
    # SOUNDCLOUD_CLIENT_ID を返します。例えば、JavaScriptのコードでSoundCloudのAPIを利用する際に、client_id が必要な場合に使うことがあります。
  end
end
