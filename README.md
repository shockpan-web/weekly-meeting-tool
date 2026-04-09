# 📋 FocusBoard

**「報告だけの会議」をゼロにする。**
FocusBoardは、チームの週間ミーティングを劇的に効率化するための超軽量・サーバーレスWebアプリです。

メンバーが会議の前に非同期で状況（On Track / At Risk / Blocked）を入力しておくことで、マネージャーは**「会議の冒頭で全員の問題点（Blocker）だけに一瞬でフォーカスする」**ことができます。ITの専門知識がないチームでも、「サーバーなし」「維持費ゼロ」で今すぐ使い始められるように設計されています。

![FocusBoard Dashboard Concept](https://img.shields.io/badge/Status-Open%20Source-blue) ![Firebase](https://img.shields.io/badge/Backend-Firebase-FFCA28) ![No%20Server](https://img.shields.io/badge/Server-None-lightgrey)

---

## 🎯 魔法の機能「⚡ Focus Mode」
ダッシュボード画面右上にある `⚡ Focus` ボタンを押すと、問題なく進んでいる（🟢 On Track）タスクが画面からスッと消え、**注意が必要な問題（🔴 Blocked / 🟡 At Risk）だけが浮き上がります**。
ミーティングはこの画面を見ながら「どうやってこの問題を解消するか？」という意思決定のアクションだけに集中できます。

---

## 🚀 【一番・分かりやすい】徹底開始マニュアル

ITやプログラミングの知識は一切不要です！以下のステップをそのままなぞるだけで、誰でも5分でチームに導入できます。

### Step 1: データベース（Firebase）を準備する
データの保存場所としてGoogleの無料サービス「Firebase」を使います。

1. [Firebase Console](https://console.firebase.google.com/) にアクセスし、Googleアカウントでログインします。
2. **「プロジェクトを追加」**をクリックし、適当な名前（例: `FocusBoard-TeamA`）をつけて作成します（Googleアナリティクスは無効でOKです）。
3. 左側のメニューから **「構築」 > 「Firestore Database」** をクリックし、**「データベースの作成」** を押します。
4. ※重要※ ロケーションを選んだ後、**「テストモードで開始する」** を選んで作成を完了させます（これで誰でも保存できるようになります）。

### Step 2: アプリとデータベースを紐付ける
作成したデータベースの「鍵」を、このFocusBoardアプリに教えます。

1. Firebaseの左メニューの一番上にある ⚙️（歯車マーク）から **「プロジェクトを設定」** をクリックします。
2. 画面下部の「マイアプリ」にある **`</>`（ウェブ）** アイコンをクリックして、アプリを登録します（名前は自由です、Hosting設定は不要）。
3. 表示されたコードの `const firebaseConfig = { ... };` の中身をコピーします。
4. ダウンロードしたFocusBoardのフォルダ内にある、以下のファイルを開いてペーストして上書き保存します。
   *ファイル場所:* `focusboard/static/js/firebase-config.js`

```javascript
/* 変更後のイメージ */
const firebaseConfig = {
  apiKey: "AIzaSyBxxxxxxx",
  authDomain: "focusboard-teama.firebaseapp.com",
  projectId: "focusboard-teama",
  storageBucket: "focusboard-teama.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:12345:web:abcd"
};
```

### Step 3: チームメンバーとプロジェクトを登録する
誰がどのプロジェクトをやっているかを登録します。

1. `focusboard/data/members.json` をテキストエディタ（メモ帳など）で開きます。チームメンバーの名前とID、権限(`member` または `manager`)を記述します。
2. `focusboard/data/projects.json` を開きます。プロジェクト名と、それに所属するメンバーのIDを記述します。

> ※書き方がわからない場合は、元から入っているサンプルのデータを真似して書き換えるだけでOKです！

### Step 4: メンバー全員の専用画面を一発で作る！
MacのターミナルやWindowsのコマンドプロンプトを開き、ダウンロードしたフォルダの場所に移動して、以下の魔法のコマンドを入力します。

```bash
python3 focusboard/generate_input_html.py
```

すると、魔法のように `focusboard/dist/` フォルダの中に、チームメンバー全員分の「専用報告画面のHTMLファイル（例: `alex.html`）」が自動で作成されます！

### （オプション）まずは自分のPCで動かしてみる！
いきなりみんなに配る前に、正しく設定できたか自分のPCでダッシュボードを開いて確認してみましょう。同じくターミナルで以下のコマンドを打ち込みます。

```bash
cd focusboard
python3 -m http.server 8080
```

その後、ブラウザを開いて `http://localhost:8080/dashboard.html?member=alex` にアクセスし、ダッシュボードが表示されれば大成功です！（確認が終わったらターミナルで `Ctrl + C` を押して終了します）

### Step 5: チームへ共有して使い始める（本番公開）
生成されたアプリ（静的ファイル）をみんながアクセスできる場所に置くだけです。
高価なサーバー契約や複雑なシステムは一切不要で、**無料で公開する方法がいくつもあります**。

以下の3つから自チームにあった運用方法を選んでください。

**おすすめ①：Netlify Drop を使う（最も簡単・10秒で完了）**
会員登録すら最初は不要で、ドラッグ＆ドロップだけで公開できる魔法のようなサービスです。
1. [Netlify Drop](https://app.netlify.com/drop) のページを開きます。
2. 今回ダウンロードした `focusboard` のフォルダを、そのまま画面の丸い枠の中にドラッグ＆ドロップします。
3. わずか数秒で `https://xxxx-xxxx-12345.netlify.app` のような公開URLが発行されます！

**おすすめ②：Firebase Hosting を使う（一元管理できて安心）**
せっかくデータベースとしてFirebaseを作成したので、ついでにそこの「ウェブサイト公開機能（Hosting）」を利用する方法です。
1. Firebase コンソールの左メニューから「**Hosting**」を選び、「始める」をクリックします。
2. 画面の指示に従ってコマンド（`npm install -g firebase-tools` など）をターミナルで打ち込みます。
3. 最後にターミナルで `firebase deploy` と打つだけで、`https://focusboard-teama.web.app` のような専用URLで公開されます。

**おすすめ③：GitHub Pages を使う（オープンソース好き向け）**
ソースコードをGitHubで管理していきたいなら、この方法が一番スマートです。
1. このプログラム一式を GitHub にアップロード（Push）します。
2. リポジトリの **Settings （設定）タブ** > 左メニューの **Pages** を開きます。
3. Source（公開元）を `main` ブランチにして保存します。
4. 数分待つと `https://[あなたのユーザー名].github.io/focusboard/` に自動で世界に公開されます！

**みんなの使いかた:**
どの方法で公開しても、以下のようにみんなにURLを共有して使ってもらいます。
* **チームメンバー**: `[公開されたURL]/[自分のID].html` にアクセスして状況を選んでSubmit！（Netlify DropやGitHub Pagesの場合は `dist/[自分のID].html` となります）
* **マネージャー**: `[公開されたURL]/dashboard.html` を開いて全体状況をチェック！⚡ Focus Modeを活用！
* **管理画面（管理者のみ）**: `[公開されたURL]/admin.html` で設定変更やお知らせ配信！

---

## 🛠 トラブルシューティング
* **「データが保存されない・表示に失敗する」**
  Firebaseの `Firestore Database` が有効になっているか、Step 1-4 の「テストモードで開始（またはルール設定）」が正しく行われているか確認してください。
* **特定の人がDashboardを見られない**
  マネージャーは `members.json` で `"role": "manager"` と設定されている必要があります。

もっと細かい仕様やカスタマイズ方法を知りたい場合は、[docs/FocusBoard_Specification_v5.md](docs/FocusBoard_Specification_v5.md) をご覧ください。
