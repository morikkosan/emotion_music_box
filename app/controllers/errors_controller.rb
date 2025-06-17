class ErrorsController < ApplicationController
  def not_found
    render template: "errors/404", status: 404, layout: true
  end

  def internal_server_error
    render template: "errors/500", status: 500, layout: true
  end
end
