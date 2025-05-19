Rails.application.routes.draw do
  devise_for :users,
    controllers: {
      omniauth_callbacks: 'users/omniauth_callbacks',
      registrations:      'users/registrations',
        sessions: 'users/sessions'

    },
    path: ''

  root 'emotion_logs#index'

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
    collection { post :toggle }   # POST /bookmarks/toggle二連打防止
  end

  get :my_emotion_logs,          to: 'emotion_logs#my_emotion_logs'
  get 'jamendo/search',          to: 'jamendo#search'
  get '/soundcloud_client_id',   to: 'sound_cloud#client_id'
  get '/soundcloud/search',      to: 'sound_cloud#search'
  get "tags/search", to: "tags#search"

  # PWA／ヘルスチェック
  get 'up',               to: 'rails/health#show',           as: :rails_health_check
  get 'service-worker',   to: 'rails/pwa#service_worker',    as: :pwa_service_worker
  get 'manifest',         to: 'rails/pwa#manifest',          as: :pwa_manifest
get '/auth/failure', to: 'users/omniauth_callbacks#redirect_on_failure'
  get '/sign_in', to: redirect('/')


end
