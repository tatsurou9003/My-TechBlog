# ハッカソンで Amazon Bedrock 使ってみた話

### こちらの記事は 2024/03 の [Shinonome テックブログ](https://blog.shinonome.io/amazon-bedrock/)を移管しました。

こんにちは、開発業務でバックエンドを担当している Tatsuro です。（大学 4 年）🤖

料理のレシピを AI に生成してもらうアプリを考案し、最近 AWS のサービスを学習していたこともあって、Bedrock を使用してみることにしました。

figma を使って雑にデザインを起こしました。荒は目立ちますが時間がなかったのでご愛嬌ということで。  
パラメータとして野菜の種類・主菜 or 副菜・冷 or 温、を選択して送信し、生成されたレシピを受け取ります。  
![design](http://blog.shinonome.io/content/images/2024/03/design.png)

## Amazon Bedrock とは

Amazon Bedrock とは、  
開発者が主要な AI スタートアップや Amazon が提供する高パフォーマンスな基盤モデルを、統合 API を通じて利用できるようにするフルマネージド型サービス、らしいです。

簡単に言うと、OpenAI や Claude の API などの生成 AI サービスがカタログ状にまとまっているということです。

Bedrock を利用するメリットとしては、生成 AI サービスが一覧でまとめられていること・既存の AWS リソースと組み合わせることができる（中でも使い慣れた boto3 の記法で扱うことができ、アプリケーションに組み込むのが容易であることが大きいか？）

https://aws.amazon.com/jp/bedrock/

## Architecture

クライアントサイドは Flutter Web、サーバーサイドは AWS のサーバレスアーキテクチャを採用しました（認証は Amplify と cognito でササっと済ませた)。lambda 内の boto3 から Claude の API を叩く構成です。
![architecture](http://blog.shinonome.io/content/images/2024/03/architecture.png)

## Lambda 関数

```python
'''
東京リージョンで使える基盤モデルが、TitanとClaudeのみだったのでClaudeのv2.1を利用しました。
バージニアでClaude3 Haiku使った方が安かったけど精度が気になったのでv2.1にしておいた。が、後でちゃんと調べたらHaikuの方が誤答の可能性が低いらしいのでHaikuにしとけばよかった、、（正確で速い上に安いとかメリットしかないじゃん）
'''


def lambda_handler(event, context):
    bedrock_runtime = boto3.client(service_name='bedrock-runtime', region_name='your-region')

    model_id = "anthropic.claude-v2:1"
    text = '''
    指定した野菜、主菜or副菜、温かいor冷たい、の条件で1つの料理の作り方を考えてください。
    '''
    prompt = f"日本語で答えてください。{text}"
    max_tokens = 300

    user_message = {"role": "user", "content": event.get("ingredients")}
    messages = [user_message]

    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": prompt,
            "messages": messages
        }
    )

    response = bedrock_runtime.invoke_model(body=body, modelId=model_id)
    response_body = json.loads(response.get('body').read())

    return {
        'statusCode': 200,
        'body': json.dumps(response_body),
    }
```

```python
パラメータとしてeventに含ませる
{
 "ingredients": "トマト,キュウリ,ナス,温かい,メイン料理"
}
```

```python
レスポンスで生成されたレシピ（json出力をデコードしたもの）
{
 "id": "xxxxxxxxx",
 "type": "message",
 "role": "assistant",
 "content": [
   {
     "type": "text",
     "text": "はい、トマト、キュウリ、ナスを使った温かいメイン料理ですね。\n\nそこでおすすめするのは「トマトとナスのグラタン」です。\n\n材料はトマト、ナス、チーズ、粉チーズなど。\n\n作り方は、\n\n1. トマトとナスを食べやすい大きさに切る\n\n2. オーブン耐熱皿にトマト、ナス、チーズを交互に層状に詰め込む\n\n3. 粉チーズをかける\n\n4. 220度のオーブンで15-20分焼く\n\nといった感じで、トマトとナスのうまみがグラタンの中でよくからみ合う温かいオーブン料理になります。キュウリはサラダや付け合せで添えればいいバランスの一品になると思います。\n\nいかがでしょうか? "
   }
 ],
 "model": "claude-2.1",
 "stop_reason": "max_tokens",
 "stop_sequence": null,
 "usage": {
   "input_tokens": 91,
   "output_tokens": 300
 }
}
```

こんな感じでレシピを受け取って apigateway のエンドポイントを通して返却しました。  
Flutter 側で受け取ったレシピは採用する場合、dynamoDB に post するように別の lambda 関数を利用するようにしました。

## 総括（ハッカソンの反省）

今回は、旬な Bedrock を AWS サービスに組み込んで開発してみた話をしました。

個人的に boto3 の記法に慣れていることもあってすんなり使えました。（Claude の API は叩いたことなかった）

ハッカソン中、Amplify で Flutter Web の build が出来なかったので、S3&CloudFront でデプロイしました（amplify pull で amplifyconfiguration.dart が生成されずに諦めた）。

また、今回はコンソールからゴリゴリの手打ちで実装しましたが、Amplify で appsync を使う構成にしたり（今回は auth だけ利用した）、サーバレスフレームワークを使って実装してみたりと改善点は多そうです。

機能も最低限の実装しか出来なかったため、現在は公開を停止しています。
https://github.com/tatsurou9003/BrachioCup_2024

また時間があるときに実装してデプロイしようかなあと考えているところです。

![----------2024-03-23-1.02.42](http://blog.shinonome.io/content/images/2024/03/----------2024-03-23-1.02.42.png)
余談ですが、先日 AWS の SAP を取得しました ✌️（正直、小規模な実開発には役立ちそうにないですが 😢）  
それでは次回の記事でお会いしましょう、さようなら 👋
