Rails.application.routes.draw do
  devise_for :users,
    controllers: {
      omniauth_callbacks: 'users/omniauth_callbacks',
      registrations:      'users/registrations'
    },
    path: ''

  root 'emotion_logs#index'

  resources :emotion_logs do
    collection do
      get :chart_data
      get :bookmarks
      get :form
      get :form_switch
    end
  end


  resources :bookmarks, only: %i[create destroy] do
    collection { post :toggle }   # POST /bookmarks/toggle二連打防止
  end

  get :my_emotion_logs,          to: 'emotion_logs#my_emotion_logs'
  get 'jamendo/search',          to: 'jamendo#search'
  get '/soundcloud_client_id',   to: 'sound_cloud#client_id'
  get '/soundcloud/search',      to: 'sound_cloud#search'

  # PWA／ヘルスチェック
  get 'up',               to: 'rails/health#show',           as: :rails_health_check
  get 'service-worker',   to: 'rails/pwa#service_worker',    as: :pwa_service_worker
  get 'manifest',         to: 'rails/pwa#manifest',          as: :pwa_manifest
end
