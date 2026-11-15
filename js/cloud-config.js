/* PokeLearn 云同步公开配置（由 workbuddy_cloud_service 返回的 publicConfig）
 * 这些值可以放在前端：publishableKey 本身没有权限，服务端校验 Origin 与登录会话。
 * 切忌把任何长期密钥 / service-role key 写进这里。 */
const CLOUD_CONFIG = {
  endpoint: 'https://wbapp-ig9wrpabw0v66x4kzqyd6s.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_ig9wrpAbw0v66x4kZQYD6S_AMEvkA1XOz5Lx6l7DGtEBzKmuZrlYHZ5'
};
/* 云服务的 Origin 校验要求页面就跑在这个域名下（发布后的云同步版链接）。
   GitHub Pages / 本地 / 桌面版只能使用本地存档，登录入口会给出明确提示，不静默降级。 */
const CLOUD_HOST = 'app.workbuddy.host';
