Rails.application.routes.draw do
  devise_for :users,
    controllers: {
      omniauth_callbacks: 'users/omniauth_callbacks',
      registrations: 'users/registrations'
    },
    path: ''

  root "emotion_logs#index"

  resources :emotion_logs do
    collection do
      get :chart_data
      get :bookmarks
    end
  end

  get :'my_emotion_logs', to: 'emotion_logs#my_emotion_logs'
  get 'jamendo/search', to: 'jamendo#search'
  resources :bookmarks, only: %i[create destroy]
  get "/soundcloud_client_id", to: "sound_cloud#client_id"

  get "up" => "rails/health#show", as: :rails_health_check
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
end
