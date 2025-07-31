describe PushNotifier do
  describe '.send_bookmark_notification' do
    let(:user) { create(:user, push_subscription: create(:push_subscription)) }
    let(:by_user_name) { 'テストユーザー' }
    let(:track_name) { 'テスト曲' }

    it 'ブックマーク通知を送信する' do
      expect(PushNotifier).to receive(:send_web_push)
  .with(user, title: "⭐ ブックマークされました", body: "テストユーザーさんが「テスト曲」をブックマークしました")

      PushNotifier.send_bookmark_notification(user, by_user_name: by_user_name, track_name: track_name)
    end
  end
end
