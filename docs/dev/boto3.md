## AWS SDK for Python (Boto3)で技術課題を解決した話

### こちらの記事は 2024/01 の [Shinonome テックブログ](https://blog.shinonome.io/aws-boto3/)を移管しました。

こんにちは、開発業務でバックエンドを担当している Tatsuro です。（大学 4 年）🤖  
今回は AWS SDK for Python (Boto3)で技術課題を解決した話をしようと思います。

僕が業務内で直面した課題解決には、以下の要件が必要とされました。

- django-app から EC2 インスタンスを起動、終了できる。
- EC2 インスタンス内で実行するプログラムに必要なパラメータを渡す。
- プログラムを実行するインスタンスのメトリクスを取得する。

これらの要件を満たせるような技術選定を行った結果、AWS SDK for Python (Boto3) を採用することにしました。

django-project のディレクトリに module として組み込んで view から呼び出します。

![----------2024-01-27-4.00.25](http://blog.shinonome.io/content/images/2024/01/----------2024-01-27-4.00.25.png)

## Boto3 とは

AWS SDK (Amazon Web Services Software Development Kit)　とは、
開発者が AWS のクラウドサービスとやり取りするためのライブラリおよびツールを提供します。各主要プログラミング言語に対応した複数の SDK が存在し、これらを用いることでアプリケーションから直接 AWS サービスを管理・操作できます。
これの python クライアントです。ちなみに boto はアマゾンカワイルカの意味らしい。可愛い 🐬

https://boto3.amazonaws.com/v1/documentation/api/latest/index.html#

## アーキテクチャ

django から EC2 を複数起動してゴチャゴチャする感じです。EC2 は S3 とファイルをやりとりします。
![----------2024-01-27-5.37.24](http://blog.shinonome.io/content/images/2024/01/----------2024-01-27-5.37.24.png)

## EC2 の起動・終了

```python
#　インスタンスを起動する関数
def launch_instance():
    ec2 = boto3.client("ec2", region_name=region_name)
    user_data_script = f"""#!/bin/bash
    yum update -y
    yum install -y awscli
    yum install cronie -y
    """
    user_data_encoded = base64.b64encode(user_data_script.encode()).decode()
    response = ec2.run_instances(
        ImageId="ami-0123456789",
        MinCount=1,
        MaxCount=1,
        InstanceType="t3.large",
        UserData=user_data_encoded,
        KeyName="key",
        IamInstanceProfile={"Name": "EC2Role"},
        BlockDeviceMappings=[
            {
                "DeviceName": "/dev/xvda",
                "Ebs": {
                    "VolumeSize": 100,
                    "DeleteOnTermination": True,
                    "VolumeType": "gp2",
                },
            }
        ],
        NetworkInterfaces=[
            {
                "SubnetId": "subnet-0123456789",
                "DeviceIndex": 0,
                "AssociatePublicIpAddress": True,
                "Groups": ["sg-0123456789"],
            }
        ],
        MetadataOptions={
            "HttpTokens": "optional",
        },
    )

    instance_id = response["Instances"][0]["InstanceId"]
    return instance_id

# 起動中のインスタンスを終了させる関数
def terminate_instance(instance_id):
    ec2 = boto3.client("ec2", region_name=region_name)

    response = ec2.terminate_instances(
        InstanceIds=[
            instance_id,
        ]
    )

    return response
```

雑に書いてみましたがこんな感じです。

UserData の中でインスタンス立ち上げ時に行われる処理を定義できます。定義する際は base64 でエンコードすることをお忘れなく。

接続するストレージやインスタンスタイプは勿論、同時に起動させる台数も指定できます。

終了する際は instance_id を渡してあげることで終了できます。

注意：今回の要件では立ち上げたインスタンスが自動終了するプログラムを動かす必要があったため、一時的に MetadataOptions で IMDS を ver1 に落としています。本来は ver2 にしないとセキュリティ的にまずいです。

```python
aws s3 cp s3://bucket_name/key/hoge.json /home/ec2-user/
```

インスタンス内部で実行するプログラムにパラメータを渡すために、一度 django から S3 にファイルを保存します。その後、上記のようにインスタンス起動時 UserData の中で S3 からファイルを取り込むようにしました。

## CloudWatch からデータ取得

```python
def get_metrics(instance_id):
    cloudwatch = boto3.client("cloudwatch", region_name=region_name)

    end_time = datetime.utcnow()
    start_time = end_time - timedelta(minutes=5)

    response = cloudwatch.get_metric_statistics(
        Namespace="AWS/EC2",
        MetricName="CPUUtilization",
        Dimensions=[
            {"Name": "InstanceId", "Value": instance_id},
        ],
        StartTime=start_time.isoformat(),
        EndTime=end_time.isoformat(),
        Period=300,
        Statistics=["Average"],
    )

    return response
```

CloudWatch からのメトリクス取得はこんな感じです。instance_id を指定してデータを取得できます。
今回は CPU 使用率（5 分間の平均値）を指定して返しています。便利ですね。

## 総括

今回は Boto3 を使って技術課題を解決した話をしました（まあ、実際の開発時の要件はもっと複雑で、同時に立ち上げるインスタンスの役割が異なるために UserData もインスタンスごとに違ったり、paramiko 使ってインスタンスの中でシェルスクリプト叩かせたり大変だった）。

Boto3 はほぼ全ての AWS リソースを操作でき、サーバーサイドに容易に組み込んで扱うことができます。素晴らしい！

余談ですが、最近 AWS 資格に興味が出てきたので SA-Associate を取得してみようと思います（USD150 ＄は学生の財布に優しくない 🥺）。
それでは次回の記事でお会いしましょう、さようなら 👋
