import { defineConfig } from "vitepress";

export default defineConfig({
  title: "tatsurou9003のテックブログ",
  description: "しがないエンジニアのメモ",
  themeConfig: {
    sidebar: {
      "/": [
        {
          text: "自己紹介",
          items: [{ text: "記事", link: "/dev/" }],
        },
      ],
      "/dev/": [
        {
          text: "技術ブログ",
          items: [
            {
              text: "ハッカソンで破産しかけた",
              link: "/dev/flutter-hackathon",
            },
            { text: "CDKのテスト", link: "/dev/cdk-test" },
            { text: "ハッカソンでAWS Bedrock使った", link: "/dev/bedrock" },
            { text: "実務でAWS SDK使った", link: "/dev/boto3" },
            { text: "ロボホンと遊ぼう", link: "/dev/robo-phone" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/tatsurou9003" }],
  },
});
