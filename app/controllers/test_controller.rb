class TestController < ApplicationController
  def crash
    raise "強制的に500エラーを発生させています"
  end
end
