# EMOTION MUSIC BOX
音楽と感情のアプリ

### ER図
![ER図](https://i.gyazo.com/61026d2bc54eaf1947f83289763d18b1.png)

---

## 目次
- [サービス概要](#サービス概要)
- [このサービスへの思い・作りたい理由](#このサービスへの思い作りたい理由)
- [ユーザー層について](#ユーザー層について)
- [サービスの差別化ポイント・推しポイント](#サービスの差別化ポイント推しポイント)
- [使い方（3ステップ）](#使い方3ステップ)
- [主な機能](#主な機能)
- [リリース時点の挙動メモ](#リリース時点の挙動メモ)
- [テスト構成（Jest 概要）](#テスト構成jest-概要)
- [使用技術（Tech Stack）](#使用技術tech-stack)

---

## サービス概要

**現代人が日々感じるストレスを、音楽と気分の記録を通じて軽減する。**  
ユーザーはその時の気分に合った音楽を探して再生するだけでなく、**自身の感情と音楽の組み合わせを投稿し、他のユーザーと共有できるコミュニティ型サービス**です。

## このサービスへの思い・作りたい理由

私は**音楽専門学校**を経て、以前バンドでライブをしたり曲を作ったり、**音楽に携わること**をしていました。  
**音楽なしでは生きられない**人間でした。  
小学生の時から**iPod**などを使用し、気分によってどんなジャンルの音楽を聴いていたかで**ストレスを和らげていました**。  
音楽によるストレス発散は、僕だけじゃなく**誰しもがそうです**。  
だからこそ、このアプリを作りたいと思いました。

## ユーザー層について

**ストレスを抱える現代人、音楽で気分を切り替えたい人。**  
年齢や性別を問わず、**気軽に使えるサービス**です。

## サービスの差別化ポイント・推しポイント

- **感情と音楽の融合**  
  単なる音楽ストリーミングやSNSではなく、「**今の気分**」と「**音楽**」を結びつけることで、自分の状態を客観的に把握しやすくなります。  
  **HPバー**で**ストレス状態を可視化**し、ユーザー自身の変化に気づかせると同時に、**コミュニティの共感**も呼びます。

---

## 使い方（3ステップ）
1. **ログイン or 新規作成**：SoundCloud アカウントでサインイン（未所持ならかんたん新規作成）
2. **投稿**：その時の感情と曲、ひとことを記録
3. **楽しむ**：気になる投稿はブックマークやコメント、プレイリストに追加して再生  
   他ユーザーとの共感性も高めます。

---

## 主な機能

### 1) アカウント / 認証
- SoundCloud OAuth による新規作成＆ログイン（OmniAuth）
- 新規登録者は公式 SoundCloud の登録ページに遷移します（簡単登録）
- 登録後タブを閉じてログインを行ってください
- 初期は SoundCloud ユーザーネームですが、
- お好みでプロフィール編集でプロフィール画像、名前、性別、名前が作成できます
- セッション管理（Cookieストア）

新規登録
<img src="https://i.gyazo.com/d0476f8750b234c705ec7d85e20608be.png" alt="新規登録" width="1280" height="720">

ログイン
<img src="https://i.gyazo.com/61d215d1bfb16143db93db5624d38b0a.png" alt="ログイン" width="1280" height="720">


### 2) 投稿（感情ログ）
- 感情（例：イライラ / 楽しい など）＋曲情報＋ひとことメモを1つのログとして保存
- 投稿を忘れたときの前日分の投稿も可能
- タグ付け、ブックマーク数・コメント数を表示
- 投稿詳細ページ（モバイル用とPC用の最適化ビュー）
投稿曲検索フォーム１
<img src="https://i.gyazo.com/839fab9843a4cc3ef9c9fd34733d37c2.png" alt="投稿検索再生フォーム" width="1280" height="720">
投稿フォーム２
<img src="https://i.gyazo.com/87fcadbb2fe7aba6f04c68dd5b6777cd.png" alt="投稿フォーム" width="1280" height="720">



### 3) 投稿検索・再生
- SoundCloud の曲情報を利用した楽曲再生（オリジナルプレーヤー / リンク再生）
- 投稿にあるアルバム中の再生ボタンを押せば曲へ即アクセス再生
- 下部メニューから検索を押せば条件検索ができる  
  ※デスクトップ版は上メニュー部分にジャンル＆タグ検索、サイドバーでさらに細かい条件検索

### 4) ブックマーク & プレイリスト
- 気になった投稿をブックマーク（♡） 
  マイページの「自分の投稿も含める」にチェックを入れると自分が投稿した投稿楽曲も表示されます  
  → プレイリストを作成する
- プレイリスト画面
  - 1曲目から再生
  - 曲を追加：モーダル（ブックマーク・自分の投稿済みの中から、**プレイリスト未収録のみ**を表示）
  - 一覧に戻る
  - 曲の削除
- **Turbo Stream** による即時反映  
  追加／削除で **プレイリスト本体とモーダル候補が自動更新** を実装
  プレイリスト作成
  <img src="https://i.gyazo.com/564f1ee8e306c8c4d224d9d531c9460c.png" alt="ブックマーク &amp; プレイリスト" width="1280" height="720">

プレイリスト内
<img src="https://i.gyazo.com/a473b1dc619bb893d5aa3a73027fb744.png" alt="プレイリスト" width="1280" height="720">


### 5) コメント & リアクション
- 投稿詳細画面にてコメント＆リアクションスペース
- いいね等のリアクション（それな！／よんだ！）
<img src="https://i.gyazo.com/fa125c7fde6bfe19698d75d44a852cd4.png" alt="コメント &amp; リアクション" width="1280" height="720">

### 6) シェア
- X（Twitter）共有ボタン（投稿詳細からワンタップでシェア）  
  例：「今日の感情は ○○！！ この気分で聴いた曲は ××」

ユーザーメニュー<img src="https://i.gyazo.com/1c941c7a64ef8d849fbc684e8ed6d8a1.png" alt="ユーザーメニュー" width="1280" height="720">

### 7) モバイル最適化
- モバイル専用のフッターメニュー（再生／追加／戻る／削除／次の曲／前の曲／再生時間をコントロールできるシークバー／リピート／シャッフル）
- セーフエリア（iPhone）対応、軽量なUI部品
- 主要操作をフッターメニュー画面下部に集約して片手操作が容易に  
  デスクトップ版でもブラウザのサイズ変更をすればスマホ版にすぐ切り替わるストレスフリーな設計

### 8) 通知
- 通知（Web Push / VAPID）

本アプリは **Web Push（VAPID）** に対応しており、コメント／いいね等の通知を受け取れます。  
ブラウザ標準の **Push API / Notifications API** と **VAPID** を使うため、APNs や Firebase SDK は不要です。  
参考：  
- MDN — Push API: https://developer.mozilla.org/docs/Web/API/Push_API  
- MDN — Notifications API: https://developer.mozilla.org/docs/Web/API/Notifications_API  
- web.dev（Web Push 概要）: https://web.dev/learn/push/

**対応環境**
- **iPhone / iPad（iOS / iPadOS 16.4+）**  
  - 必須：**ホーム画面に追加（PWAインストール）→ そのアイコンから起動**  
  - Safari の通常タブのままでは通知は届きません  
  参考：Apple Developer（Web Push）: https://developer.apple.com/documentation/usernotifications/sending_web_push_notifications_in_web_apps  
  参考：OneSignal Docs: https://documentation.onesignal.com/
- **Android（Chrome / Edge など）**  
  - **インストール不要**。サイト内の「通知を有効にする」からブラウザの通知を許可すればOK（ホーム画面追加も任意）  
  参考：web.dev — https://web.dev/learn/push/
- **PC（Chrome / Edge / Safari 等）**  
  - **インストール不要**。初回アクセス時または設定から通知を許可してください  
  参考：MDN — Notifications API: https://developer.mozilla.org/docs/Web/API/Notifications_API

**使い方（最短手順）**
- **iOS**：サイトを開く → 共有メニュー → **「ホーム画面に追加」** → ホーム画面のアイコンから起動 → アプリ内の**「通知を有効にする」**をタップして許可  
  参考：Apple Developer（Web Push）: https://developer.apple.com/documentation/usernotifications/sending_web_push_notifications_in_web_apps  
  参考：OneSignal Docs: https://documentation.onesignal.com/
- **Android / PC**：サイトを開く → **「通知を有効にする」**をクリック → ブラウザのダイアログで **許可**  
  参考：web.dev — https://web.dev/learn/push/

---

## リリース時点の挙動メモ
- プレイリストへの**追加・削除は即時反映**（Turbo Stream）。  
  モーダルを閉じずに連続追加が可能。閉じても再読み込みは不要です。
- モバイルでもフッターメニューが常時固定で操作しやすい設計。

---

## テスト構成（Jest 概要）
- `spec/javascripts/globals/application.entry.test.js`  
  …エントリの基本（UJSログ、push二重防止、ローダー、モーダル保険など）
- `spec/javascripts/globals/application.entry.extra.test.js`  
  …アバター（Crop確定／Cloudinary 分岐、recommend など周辺UI）
- `spec/javascripts/globals/application.entry.toppers.test.js`  
  …取りこぼし潰し（turbo:before-cache、2つの MutationObserver 等）
- `spec/javascripts/globals/application.entry.tinygap.test.js`  
  …微細な枝や条件の最終カバー

---

## 使用技術（Tech Stack）

### ランタイム / 基盤
- **Ruby 3.2.3**
- **Rails 7.2.2.1**（Hotwire: Turbo / Stimulus）
- Docker / Docker Compose（v2）

### インフラ・ミドルウェア
- **PostgreSQL**
- **Redis**（セッションストア）
- **HTTPS**（Puma + PEM）

### フロントエンド（Rails 内）
- Hotwire（Turbo / Stimulus）
- Bootstrap 5.3
- jsbundling-rails / cssbundling-rails
- Sprockets（一部アセット）

### 認証・認可
- Devise
- OmniAuth（SoundCloud OAuth2 / Generic OAuth2）

### ストレージ / 画像
- Active Storage + Cloudinary
- image_processing

### 画面/UX・ページング・集計
- Kaminari（bootstrap5-kaminari-views）
- Groupdate

### 通信 / ユーティリティ
- HTTParty / Faraday

### 監視・ログ
- Sentry（sentry-rails / sentry-ruby）
- Lograge
