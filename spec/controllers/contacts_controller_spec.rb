RSpec.describe ContactsController, type: :controller do
  describe "GET #new" do
    it "新しいContactインスタンスがセットされる" do
      get :new
      expect(assigns(:contact)).to be_an_instance_of(Contact)
      # persisted? を使う場合: expect(assigns(:contact)).not_to be_persisted
      expect(response).to have_http_status(:ok)
    end
  end

  describe "POST #create" do
    let(:valid_params) do
      { contact: { name: "森さん", email: "test@example.com", message: "こんにちは！お世話になります。" } }
    end

    let(:invalid_params) do
      { contact: { name: "", email: "invalid", message: "" } }
    end

    it "有効な値ならメール送信してリダイレクト" do
      mailer = double("ContactMailer", notify_admin: double(deliver_now: true))
      allow(ContactMailer).to receive(:with).and_return(mailer)
      post :create, params: valid_params
      expect(response).to redirect_to(emotion_logs_path)
      expect(flash[:notice]).to eq "お問い合わせ内容を送信しました。"
    end

    it "無効な値なら:unprocessable_entityで再描画" do
      post :create, params: invalid_params
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response).to render_template(:new)
      expect(assigns(:contact).errors).not_to be_empty
    end
  end
end
