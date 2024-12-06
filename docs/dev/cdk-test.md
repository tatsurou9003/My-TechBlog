# AWS CDK とローカルテスト戦略

### こちらの記事は 2024/05 の [Shinonome テックブログ](https://blog.shinonome.io/aws_localtest/)を移管しました。

こんにちは！今年度は業務で PM を担当している Tatsuro です（決して偉くなったわけではない）。
今回は、AWS CDK のローカルテストについて調べてみたので紹介します。
戦略といえるほどのものではないかもしれませんが・・・

https://github.com/tatsurou9003/lt_aws-cdk

AWS のサービスは基本的にコンソール上で開発できます。

ただ、ポチポチして開発するのは何かダサいし怠い・・・ということで AWS CDK に手を出して IaC 化するわけです。

そうなると勿論デプロイする前にローカルでデバッグ/テストしたくなってくるわけですが、本記事では LocalStack および SAM を通じたスタックテストについて御紹介しようと思います。

### LocalStack とは

LocalStack は、コンテナまたは CI 環境で実行されるクラウドサービスエミュレーターです。

LocalStack を使用すると、リモートクラウドプロバイダーに接続せずに、AWS アプリケーションや Lambda を完全にローカルマシン上で実行できます。

複雑な CDK アプリケーションや Terraform 構成をテストしている場合でも、AWS サービスについて学び始めたばかりの場合でも、LocalStack はテストと開発のワークフローを高速化し、簡素化するのに役立ちます。

LocalStack は、AWS Lambda、S3、DynamoDB、Kinesis、SQS、SNS など、多くの AWS サービスをサポートします・・・とのこと。要するにローカルテストにうってつけということです。

では実際に動かしてみましょう。

https://docs.localstack.cloud/overview/

```　YAML
//docker-compose.yml
version: "3.8"

services:
  localstack:
    container_name: "${LOCALSTACK_DOCKER_NAME-localstack_main}"
    image: localstack/localstack
    ports:
      - "127.0.0.1:4566:4566" # LocalStack Gateway
      - "127.0.0.1:4510-4559:4510-4559" # external services port range
    environment:
      - DEBUG=${DEBUG:-0}
    volumes:
      - "${LOCALSTACK_VOLUME_DIR:-./volume}:/var/lib/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
```

まずは doc にしたがって LocalStack のコンテナを立ち上げます。

```Shell
docker-compose up
```

コンテナ起動

```Shell
npm install -g aws-cdk-local aws-cdk
pip install awscli-local
```

コンテナの起動を確認できたら AWS CLI、CDK と LocalStack を併せて使うために、awslocal と cdklocal をインストールしておきます。

```Shell
cdklocal init -language python
```

では cdklocal プロジェクトを作成します。

![----------2024-05-14-6.43.01](http://blog.shinonome.io/content/images/2024/05/----------2024-05-14-6.43.01.png)
lib/lambda_handler.py を追加するとこのようなディレクトリ構成になるはず

```python
// cdk_local/cdk_local_stack.py
from aws_cdk import (
    Stack,
    Duration,
    aws_lambda as lambda_,
    aws_lambda_event_sources as lambda_event_sources,
)
from constructs import Construct

function_timeout = 3
function_memory_size = 128

class CdkLocalStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        lambda_function = lambda_.Function(self, "HelloWorldFunction",
            code=lambda_.Code.from_asset("lib"),
            handler="lambda_handler.lambda_handler",
            runtime=lambda_.Runtime.PYTHON_3_8,
            timeout=Duration.minutes(function_timeout),
            memory_size=function_memory_size,
        )
        lambda_function.add_event_source(lambda_event_sources.ApiEventSource(
                method="get",
                path="/hello",
            )
        )
```

```python
// lib/lambda_handler.py
import json

def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Welcome to PlayGround",
        }),
    }
```

簡単な API Gateway と Lambda のスタックを定義

```Shell
cdklocal bootstrap
```

お馴染みのコマンドで IAM ロール・バケット等のスタックを作成

```Shell
cdklocal deploy
```

コンテナにデプロイします。

```Shell
awslocal lambda list-functions
```

```Shell
{
    "Functions": [
        {
            "FunctionName": "CdkLocalStack-HelloWorldFunction000000000",
            "FunctionArn": "arn:aws:lambda:ap-northeast-1:000000000000:function:CdkLocalStack-HelloWorldFunction0000000000",
            "Runtime": "python3.8",
            "Role": "arn:aws:iam::000000000000:role/CdkLocalStack-HelloWorldFunctionServic-000000",
            "Handler": "lambda_handler.lambda_handler",
            "CodeSize": 282,
            "Description": "",
            "Timeout": 180,
            "MemorySize": 128,
            "LastModified": "2024-05-13T16:23:48.267109+0000",
            "CodeSha256": "00000000000000000000000000",
            "Version": "$LATEST",
            "TracingConfig": {
                "Mode": "PassThrough"
            },
            "RevisionId": "000000000000",
            "PackageType": "Zip",
            "Architectures": [
                "x86_64"
            ],
            "EphemeralStorage": {
                "Size": 512
            },
            "SnapStart": {
                "ApplyOn": "None",
                "OptimizationStatus": "Off"
            },
            "LoggingConfig": {
                "LogFormat": "Text",
                "LogGroup": "/aws/lambda/CdkLocalStack-HelloWorldFunction000000000000"
            }
        }
    ]
}
```

awslocal コマンドを使って deploy されている lambda 関数をリスト表示すると、先ほどの Lambda 関数を確認できました。  
では早速 API Gateway のエンドポイントにアクセスしてみましょう。と思ったけど・・・

```Shell
curl -X GET http://localhost:4566/restapis/{apiID}/test/_user_request_/hello
```

ドキュメントを見ると、apiId なるものが必要らしいです。

```Shell
awslocal apigateway get-rest-apis
```

```Shell
{
    "items": [
        {
            "id": "apiID", 　// こいつだ！
            "name": "CdkLocalStackHelloWorldFunction:ApiEventSource",
            "createdDate": "2024-05-14T01:23:53+09:00",
            "apiKeySource": "HEADER",
            "endpointConfiguration": {
                "types": [
                    "EDGE"
                ]
            },
            "tags": {
                "aws:cloudformation:logical-id": "CdkLocalStackHelloWorldFunctionApiEventSource",
                "aws:cloudformation:stack-name": "CdkLocalStack",
                "aws:cloudformation:stack-id": "arn:aws:cloudformation:ap-northeast-1:000000000000:stack/CdkLocalStack/000000"
            },
            "disableExecuteApiEndpoint": false,
            "rootResourceId": "00000000"
        }
    ]
```

```Shell
{"message": "Welcome to PlayGround"}%
```

先ほどのエンドポイントを叩くと・・・出てきました。
お次は SAM CLI でやってみましょう。

### SAM とは

AWS SAM テンプレートは、サーバーレスアプリケーション用の IaC の定義に最適化された簡潔な構文を提供します。

AWS CloudFormation の拡張機能として、SAM テンプレートを CloudFormation に直接デプロイできます。  
これにより、AWS での広範な IaC サポートの恩恵を受けることができます。SAM CLI は、SAM の機能をすぐに使えるようにするデベロッパーツールです。  
これを使用すると、サーバーレスアプリケーションをすばやく作成、開発、デプロイできます。とのこと。早い話が Lambda・API Gateway・dynamoDB のような構成に特化した CloudFormation ということですね。

こいつの良いところは、CDK で作成したテンプレートを与えてやると、ローカルで Lambda・API Gateway を動かせるところです。

では実際に動かしてみましょう。

https://aws.amazon.com/jp/serverless/sam/

https://docs.aws.amazon.com/ja_jp/serverless-application-model/latest/developerguide/install-sam-cli.html

まずは SAM CLI をインストールしましょう。GUI で出来ます。

```Shell
sam local invoke HelloWorldFunction --no-event -t ./cdk.out/CdkLocalStack.template.json
```

sam local invoke で Docker コンテナが立ち上がり、直接 Lambda 関数を呼び出せます。

```Shell
Invoking lambda_handler.lambda_handler (python3.8)
Local image is up-to-date
Using local image: public.ecr.aws/lambda/python:3.8-rapid-x86_64.

Mounting
/Users/tatsurom/Documents/aws-cdk-lt/cdk_local/cdk.out/asset.000000000000000 as /var/task:ro,delegated, inside runtime container
START RequestId: 78a999e2-47c3-4eac-b494-f9fdc01b148a Version: $LATEST
END RequestId: ###############
REPORT RequestId: #############  Init Duration: 0.69 ms  Duration: 500.30 ms     Billed Duration: 501 ms Memory Size: 128 MB     Max Memory Used: 128 MB
{"statusCode": 200, "body": "{\"message\": \"Welcome to PlayGround\"}"}
```

上手く呼び出せました。お次は API Gateway を通して呼び出してみましょう。

```Shell
sam local start-api -t ./cdk.out/CdkLocalStack.template.json
```

sam local start-api でローカルに API が立ち上がります。

```Shell
curl -X GET http://127.0.0.1:3000/hello
```

```Shell
{"message": "Welcome to PlayGround"}%
```

返ってきました。

### まとめ

いかがだったでしょうか。

今回は、LocalStack, SAM を使って AWS のサービスをローカルでテストしてみました。

所感としては、サーバレス構成の場合は圧倒的に SAM CLI が楽チンだと感じました。

LocalStack は汎用的なツールで、課金すると扱えるサービスが増えたり、より容易に扱えるようになるみたいです。

![----------2024-05-14-7.53.36](http://blog.shinonome.io/content/images/2024/05/----------2024-05-14-7.53.36.png)
少し話は逸れますが、先日コミュニティ内で LT 会を開催して登壇しました（この記事の内容も入ってた）。  
30 人近くの前で 1 時間半ぐらい喋って大変疲れました（どこが Lightning Talk やねんという声は置いておいて）。

もっとコミュニティ内で AWS に興味を持ってくれる学生が増えたらいいなと思います。

それではまた次回の記事でお会いしましょう、さようなら 👋
