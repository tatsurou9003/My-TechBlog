# ハッカソンで破産しかけた話

### こちらの記事は 2024/05 の [Shinonome テックブログ](https://blog.shinonome.io/dong-jing/)を移管しました。

みなさんこんにちは！

今年もやって参りました AdventCalendar2024 のトップバッター Tatsuro です。
「ガキども俺に続け！」というわけで、今回はハッカソンでやらかした話をしようと思います。

クラウド破産。怖いですよね、、

### Tokyo Flutter Hackathon

僕は 11/2,3 に Abema Towers で開催された Tokyo Flutter Hackathon に参加してきました。  
4 人チーム（デザイナー 1,フロント 2,バックエンド 1）で僕はバックエンド・インフラを担当しました。  
ということで、今回はハッカソンでのバックエンド・インフラ実装についてお話しします。  
（後日他のメンバーの AdventCalendar でデザイン・フロントの話があるかも？）

https://tokyo-flutter-hackathon.connpass.com/event/326665/

<div style="display: flex; justify-content: center; gap: 10px;">
    <img src="http://blog.shinonome.io/content/images/2024/11/------1.jpg" alt="------1" style="max-width: 45%; height: auto;">
    <img src="http://blog.shinonome.io/content/images/2024/11/----------2024-11-22-23.18.02-1.png" alt="----------2024-11-22-23.18.02-1" style="max-width: 45%; height: auto;">
</div>

### 実装

ハッカソンのテーマが「HOT」ということで、「HOT」→「熱い」→「辛い」？？のように連想しました。

また、Flutter といえばあの青い鳥が思い浮かんだので、DASH を使ったアプリを開発しようという結論に至りました。

というわけで、開発したアプリがこちら ↓↓↓

https://github.com/shinonome-inc/tokyo-flutter-hackathon-2024-team-PlayGround

https://d35ev4qyh6i48b.cloudfront.net/  
Web でデプロイしたけどレスポンシブ対応してないのでスマホから開いて頂けると。。  
（バグあります）

![----------2024-12-07-2.35.03](http://blog.shinonome.io/content/images/2024/12/----------2024-12-07-2.35.03.png)
![----------2024-12-07-2.36.21](http://blog.shinonome.io/content/images/2024/12/----------2024-12-07-2.36.21.png)

<div style="display: flex; justify-content: center; gap: 10px;">
    <img src="http://blog.shinonome.io/content/images/2024/11/----------2024-11-22-23.43.51-1.png" alt="----------2024-11-22-23.43.51-1" style="max-width: 45%; height: auto;">
    <img src="http://blog.shinonome.io/content/images/2024/11/----------2024-11-22-23.51.27.png" alt="----------2024-11-22-23.51.27" style="max-width: 45%; height: auto;">
</div>

簡単にアプリの説明をすると、GitHub のリポジトリ（使用言語に Dart が含まれる）へのコントリビュートを取得して、Dash に餌をあげることができる仕様になっています。  
餌をあげると経験値が貯まってレベルアップ、背景の変更や着せ替えもできます（デザイナー様々）。

### アーキテクチャ

以下のアーキテクチャで実装しました。**バックエンド・インフラ側の実装です**、  
Flutter は認証部分以外自分で書いてないのであんまわかりません（Flutter ハッカソンなのに...）。
![----------](http://blog.shinonome.io/content/images/2024/12/----------.jpg)

### こだわりポイント

##### 1. AWS CDK で IaC 化

言うまでもないっすね。サーバレス構成ってマネコンぽちぽちでも出来ますが、再現性も保守性もないしダサいっすよね。  
terraform, cdk 使いましょう。

##### 2. GraphQL で GitHub API にリクエスト

GitHub の API ってリクエスト制限かかりやすいんで GraphQL ver の API でオーバーフェッチ避けないとですよね？  
ということで query を作ってリクエストしてます。

```graphql
// lambda/utils/get_feed.py
    query = """
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          commitContributionsByRepository(maxRepositories: 100) {
            repository {
              name
              languages(first: 10) {
                nodes {
                  name
                }
              }
            }
            contributions {
              totalCount
            }
          }
          issueContributionsByRepository(maxRepositories: 100) {
            repository {
              name
              languages(first: 10) {
                nodes {
                  name
                }
              }
            }
            contributions {
              totalCount
            }
          }
          pullRequestContributionsByRepository(maxRepositories: 100) {
            repository {
              name
              languages(first: 10) {
                nodes {
                  name
                }
              }
            }
            contributions {
              totalCount
            }
          }
        }
      }
    }
```

```python
for contribution_type in ['commitContributionsByRepository', 'issueContributionsByRepository', 'pullRequestContributionsByRepository']:
            dart_contributions += sum(
                repo['contributions']['totalCount']
                for repo in response_data['data']['user']['contributionsCollection'][contribution_type]
                if any(lang['name'] == 'Dart' for lang in repo['repository']['languages']['nodes'])
            )
```

＊ 餌が「Dart が使用言語に含まれるリポジトリへのコントリビュート」なので、雑に絞り込んでます。

##### 3. Lambda Authorizer 使ってみた

アーキテクチャ図の参照の通り、API Gateway にリクエストが飛んできた場合、誰でも彼でも Lambda を動かせちゃマズいわけです。  
そこで、逐次 GitHub にアクセストークンが正しいかどうか確認するリクエストを投げてます。  
問題なければ「Lambda を Invoke するポリシー」を APIGateway に渡してあげます。

```python
// lambda/auth/authorizer.py
def generate_policy(principal_id, effect, resource, context=None):
    """IAMポリシーを生成"""
    auth_response = {
        'principalId': principal_id
    }
    if effect and resource:
        auth_response['policyDocument'] = {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource
                }
            ]
        }
    if context:
        auth_response['context'] = context

    return auth_response
```

##### 4. VOICEVOX のイメージを Lambda で動かす

Dash を喋らせるために、ubuntu の Docker イメージを ECR にプッシュして Lambda で動かす構成にしてます。  
あとは Flutter 側で受け取ったエンコードされている mp3 ファイルをデコードすればいいだけです。
（**が、今はバグってて喋りません。**）

```python
SPEAKER_ID = 1 // ずんだもんボイス

core = VoicevoxCore(
    acceleration_mode=AccelerationMode.AUTO,
    open_jtalk_dict_dir=os.environ["OPEN_JTALK_DICT_DIR"],
)
core.load_model(SPEAKER_ID)


def lambda_handler(event, context):
    print(event)
    body = base64.b64decode(event["body"]).decode("utf-8")
    query = parse.parse_qs(body)
    texts = query.get("text")
    if not texts or len(texts) == 0:
        return {
            "statusCode": 422,
            "header": ,
            "body": "Text not provided",
        }
    text = texts[0]
    print(f"text: {text}")

    mp3 = wav_to_mp3(get_voice(text))
    return {
        "statusCode": 200,
        "header": ,
        "body": base64.b64encode(mp3).decode('utf-8'),
        "isBase64Encoded": True,
    }


def get_voice(text: str) -> bytes:
    audio_query = core.audio_query(text, SPEAKER_ID)
    return core.synthesis(audio_query, SPEAKER_ID)


def wav_to_mp3(wav: bytes) -> bytes:
    with NamedTemporaryFile() as f:
        AudioSegment.from_wav(io.BytesIO(wav)).export(f.name, format="mp3")
        return f.read()
```

##### 5. **Provisioned Concurrency で lambda をウォームスタート**　 ← こいつが本題

はい、お待たせしました。長くなりましたがこいつが本題です。

僕が何をしたかったかというと（端的に）、ハッカソンのデモで良い感じに遅延なく見せたかったわけです。  
特に、音声機能なんかはレスポンスに時間がかかります（Gemini で文章生成 → VOICEVOX に投げる）。

**そこで、Lambda のメモリを爆増かつウォームスタートに設定すれば速くなるのでは？？と期待した訳です。**

もう少し詳しく説明しましょう。  
Lambda というのはそもそもコールドスタートなんです。

最初にリクエストが来た瞬間に実行環境が用意されて Lambda が動くわけです。この起動プロセスは初回または長時間アイドル状態の後に関数が呼び出されるときに行われます。  
この起動にかかる時間が実はネックで、結構時間かかったりします。

**このウォームスタートを設定するのが Provisioned Concurrency（準備された同時実行）というものです。あらかじめ台数を指定してウォームスタートで実行できます。**

また今回の料金請求にあんまり関係ないですが、メモリサイズを増やすことで Lambda 実行環境の CPU パワーや、帯域が向上します。こういった背景がありました。

**メモリ 3008MB、100 台固定で予約（AutoScaling 設定できるの知らなかった）。**

### 請求結果

![----------2024-11-25-13.34.48](http://blog.shinonome.io/content/images/2024/11/----------2024-11-25-13.34.48.png)
速くなりました。そして飛んできた請求がこちら ↓↓↓

![2c62cbca46b71077](http://blog.shinonome.io/content/images/2024/11/2c62cbca46b71077.png)
実行時間にして 12 時間、13000 円の請求が飛んできました。ハハ 🐭

### まとめ

お分かり頂けただろうか？
**ちゃんと料金計算しましょう。「12 時間だけだし多分大丈夫っしょ！！」で痛い目を見ました。**

恐ろしいのが、ハッカソンの懇親会でいろんな人から「どのくらいの期間サービス公開してるの？」と聞かれて適当に「まあ 1 ヶ月くらいすかねー」とか言ってましたが、次の日になんとなく請求確認して止めてなかったらやばかったですね。  
数十万の請求が飛んできていたことは想像に難くない（まあ Cost Anomaly Detection で怪しいメール飛んできてたけど。）

ちなみにハッカソンの結果はというと、大満足です！スポンサー賞を頂けました 😎
株式会社 YUMEMI のよーたんさんから「ゆめみ賞」として「お願い事を 1 つ叶えてもらえる券」を頂きました。
使い道はまだ秘密です！

![dsc02653__1_-1](http://blog.shinonome.io/content/images/2024/11/dsc02653__1_-1.jpg)
僕は写真右上。以下、公式ツイート。  
https://x.com/TYOFlutterHack/status/1853022449144914247

明日 12/2 の AdventCalendar 担当は Ryoma です！  
優秀なデータサイエンティストである彼なら、  
さぞ素晴らしいテックブログを書き上げてくれることでしょう！！  
**改めて、12/25 までの AdventCalendar2024 をお楽しみに！！**
