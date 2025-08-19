# config/routes.rb
Rails.application.routes.draw do

  get 'emotion_logs/playlist_sidebar_modal(.:format)', to: 'emotion_logs#playlist_sidebar_modal'

  get "contacts/new"
  get "contacts/create"
  devise_for :users,
    controllers: {
      omniauth_callbacks: "users/omniauth_callbacks",
      registrations:      "users/registrations",
      sessions:           "users/sessions"
    },
    path: ""

  root "emotion_logs#index"

  resources :emotion_logs do
    collection do
      get :chart_data
      get :bookmarks
      get :form
      get :form_switch
      get :recommended
    end

    resources :comments, only: %i[create update destroy edit], shallow: true do
      # POST /comments/:id/toggle_reaction?kind=sorena
      post :toggle_reaction, on: :member
    end
  end

  resources :bookmarks, only: %i[create destroy] do
    collection { post :toggle }   # POST /bookmarks/toggle 二連打防止
  end

  resources :playlists, only: [:new, :create, :index, :show, :edit, :update, :destroy] do
    resources :playlist_items, only: [:create, :destroy]
  end

  resource :contact, only: [:new, :create], controller: :contacts

  get :my_emotion_logs,          to: "emotion_logs#my_emotion_logs"
  get "/soundcloud_client_id",   to: "sound_cloud#client_id"
  get "/soundcloud/search",      to: "sound_cloud#search"
  get "tags",                    to: "tags#index"
  get "tags/search",             to: "tags#search"
  get "/terms",                  to: "pages#terms", as: :terms

  post '/line_bot/callback',     to: 'line_bot#callback'
  get  '/line_add_friends',      to: 'line_bot#add_friends', as: 'line_add_friends'
  get  '/line_link',             to: 'line_link#link'
  post '/users/create_line_link', to: 'users#create_line_link', as: :create_line_link

  # PWA／ヘルスチェック
  get "up",             to: "rails/health#show",        as: :rails_health_check
  get "service-worker", to: "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest",       to: "rails/pwa#manifest",       as: :pwa_manifest

  get "/auth/failure",  to: "users/omniauth_callbacks#redirect_on_failure"
  get "/sign_in",       to: redirect("/")
  get "/sc_resolve",    to: "sound_cloud#resolve"

  # ▼▼▼ ここを NotificationsController に寄せる（PushNotificationController は存在しないので使わない）▼▼▼
  post 'push/emotion',           to: 'notifications#send_emotion_log'   # ← 元: push_notification#send_emotion_log
  post '/push_subscription',     to: 'push_subscriptions#create'

  patch 'enable_push_notifications',  to: 'notifications#enable'
  patch 'disable_push_notifications', to: 'notifications#disable'

  get "notifications/test/:id",  to: "notifications#test"
  get "/notifications/test",     to: "notifications#debug_emotion", as: :debug_emotion_notifications  # ← 元: push_notification#debug_emotion
  get "notifications/public_key", to: "notifications#public_key"

  if Rails.env.test? || Rails.env.development?
    get '/debug/session_info', to: 'debug#session_info'
  end

  #   get '/line_notify_test', to: 'line_bot#test_notify'
  #   get "/debug/line_tokens", to: "line_bot#debug_tokens"
  #   get "/debug/push_message", to: "line_bot#debug_push"
  #   get "/debug/emotion", to: "line_bot#debug_emotion"
  #   get "/debug/reaction", to: "line_bot#debug_reaction"
  #   get "/debug/news", to: "line_bot#debug_news"
end
