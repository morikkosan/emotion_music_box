require 'rails_helper'

before(:each) do
  CommentReaction.delete_all
  Comment.delete_all
  Bookmark.delete_all
  PlaylistItem.delete_all   # ← これが必須
  EmotionLogTag.delete_all  # ← タグの中間も
  Tag.delete_all
  EmotionLog.delete_all
end


  let(:user) { create(:user) }

  describe "バリデーション" do
    it "有効なファクトリーでEmotionLogが作成できること" do
      expect(build(:emotion_log, user: user)).to be_valid
    end

    it "感情が未入力の場合は無効になること" do
      log = build(:emotion_log, user: user, emotion: nil)
      expect(log).not_to be_valid
      expect(log.errors[:emotion]).to include("を入力してください")
    end

    it "今日の一言が50文字を超えると無効" do
      log = build(:emotion_log, user: user, description: "あ" * 51)
      expect(log).not_to be_valid
      expect(log.errors[:description]).to include("は50文字以内で入力してください")
    end

    it "未来の日付は無効となること" do
      log = build(:emotion_log, user: user, date: Date.tomorrow)
      expect(log).not_to be_valid
      expect(log.errors[:date]).to include("は未来の日付を選択できません")
    end

    it "今日の一言に過激な表現が含まれると無効になること" do
      log = build(:emotion_log, user: user, description: "死ね")
      expect(log).not_to be_valid
      expect(log.errors[:description]).to include("に過激な表現が含まれています。やさしい言葉でお願いします。")
    end

    it "記号が含まれていても有効であること" do
      log = build(:emotion_log, user: user, description: "最高!✨")
      expect(log).to be_valid
    end
  end

  describe "スコープ" do
    describe ".for_today" do
      let!(:today_log) { create(:emotion_log, date: Date.today) }
      let!(:yesterday_log) { create(:emotion_log, date: Date.yesterday) }

      it "今日の投稿だけを返す" do
        expect(EmotionLog.for_today).to include(today_log)
        expect(EmotionLog.for_today).not_to include(yesterday_log)
      end
    end

    describe ".newest" do
      let!(:older_log) { create(:emotion_log, created_at: 1.day.ago) }
      let!(:newer_log) { create(:emotion_log, created_at: Time.current) }

      it "新しい順に並ぶこと" do
        expect(EmotionLog.newest).to eq([newer_log, older_log])
      end
    end

    describe ".for_week" do
      let!(:this_week_log) { create(:emotion_log, date: 3.days.ago) }
      let!(:old_log) { create(:emotion_log, date: 2.weeks.ago) }

      it "今週の投稿だけ返す" do
        expect(EmotionLog.for_week).to include(this_week_log)
        expect(EmotionLog.for_week).not_to include(old_log)
      end
    end
  end

  describe "タグ機能" do
    it "tag_namesを指定するとタグが作成・関連付けされること" do
      log = build(:emotion_log, user: user, tag_names: "音楽, 楽しい")
      expect { log.save! }.to change(Tag, :count).by(2)
      tag_names = log.tags.pluck(:name)
      expect(tag_names).to include("音楽", "楽しい")
    end
  end

  describe "削除時の依存関係" do
    it "EmotionLog削除時にコメントも削除されること" do
      log = create(:emotion_log, user: user)
      create(:comment, emotion_log: log)
      expect { log.destroy }.to change(Comment, :count).by(-1)
    end

    it "EmotionLog削除時にブックマークも削除されること" do
      log = create(:emotion_log, user: user)
      create(:bookmark, emotion_log: log, user: user)
      expect { log.destroy }.to change(Bookmark, :count).by(-1)
    end
  end

  describe "アソシエーション" do
    it "複数のコメントを持てること" do
      assoc = described_class.reflect_on_association(:comments)
      expect(assoc.macro).to eq :has_many
    end

    it "タグと多対多の関係を持つこと" do
      assoc = described_class.reflect_on_association(:tags)
      expect(assoc.macro).to eq :has_many
      expect(assoc.options[:through]).to eq :emotion_log_tags
    end
  end
end
