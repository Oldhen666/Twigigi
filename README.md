# Twigigi

一个给个人和小本地商家用的产品页。创建一页、发出链接、接收订单、报价或留言。不需要先搭一整家店。

公开地址是 `/{username}/{slug}`，例如 `/ava/cedar-planter`。商品页按天缓存，卖家保存后立刻刷新。买家不需要账号。

## 本地运行

```bash
npm install
npm run dev
```

打开 http://localhost:3000

示例卖家：

- 邮箱 `ava@twigigi.demo`
- 密码 `planter-demo`
- 在售页 `/ava/cedar-planter`（立即购买）
- 报价页 `/ava/garden-bench`
- 联系页 `/ava/garden-consult`

## 环境变量

复制 `.env.example` 为 `.env.local`。

- `NEXT_PUBLIC_APP_URL`：分享链接、二维码和 Stripe 回跳地址
- `AUTH_SECRET`：卖家登录 cookie 的签名
- `STRIPE_SECRET_KEY` 和 `STRIPE_WEBHOOK_SECRET`：可选。未配置时，Buy now 仍会记下未付款订单

Webhook 地址：`/api/stripe/webhook`

流量来源用 `?src=facebook` 这类参数，也会从引荐域名推断。二维码自带 `src=qr`。

数据库在 `data/twigigi.db`。删掉这个文件会重新种入示例卖家。上传的图片在 `public/uploads`。
