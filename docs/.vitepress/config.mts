import { defineConfig } from "vitepress";

export default defineConfig({
  title: "tatsurou9003のテックブログ",
  description: "しがないエンジニアのメモ",
  themeConfig: {
    sidebar: {
      "/": [
        {
          text: "トップページ",
          items: [{ text: "技術", link: "/dev/" }],
        },
      ],
      "/dev/": [
        {
          text: "技術ブログ",
          items: [
            { text: "dev1 blog", link: "/dev/dev1" },
            { text: "dev2 blog", link: "/dev/dev2" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/tatsurou9003" }],
  },
});
