# PokeLearn 永久链接与跨机器发布规范

这份文档是 PokeLearn 发布规则的唯一真相源。任何机器、任何会话更新代码前先看这里。
目的只有一个：**分享链接永远不变，任何一台机器改完代码，打开链接就是最新版。**

## 一、两条链接，各司其职

| 用途 | 永久地址 | 特性 |
|---|---|---|
| 主链接（日常使用 / 分享 / iPad 主屏 / 孩子用） | https://ericzhang0105.github.io/EricPokelearn/ | 地址永不变；任何机器 push 后 1–2 分钟自动更新 |
| 云同步（登录 / 跨设备同步存档与家长录音） | https://wbapp-ig9wrpabw0v66x4kzqyd6s.app.workbuddy.host/?sharecode=BC3RN7J6A4 | 本机可稳定重发、保持地址不变；只用于账号与数据同步 |

日常一律打开**主链接**。需要登录或跨设备同步时，点页面右上角「👤 登录 / 注册」→
一键跳转到云同步链接（当前为 ig9wrp 应用）。sharecode 必须完整保留，不能删。

### 云同步链接为何选 ig9wrp（2026-11-18 定案）
- 云服务按 Origin 精确校验：只有页面域名与 `publishableKey` 所属应用一致时登录才通过。
  实测 IrsOaLbj 域名与 ig9wrp 域名各自预检 204，但新域名 212284 为 403。
- 原来的 IrsOaLbj 链接页面内容卡在 v62 且**本机无法推送更新**（域名绑定在旧 Windows 机器目录，
  WorkBuddy 发布工具按本地目录 hash 定域名，反复验证无法覆盖），故弃用为跳转目标。
- ig9wrp 是本机稳定绑定目录（`/Users/eric.zhang/WorkBuddy/PokeLearnCloud`，hash `0d8bc2413d799978`），
  可从本机反复重发且地址不变、版本保持最新，故设为主链接的云登录跳转目标。
- **数据说明**：云数据绑定在应用 ID 上。切换到 ig9wrp 后，用同一邮箱登录后，本机存档/录音会在
  5 秒内自动上传（v63 起），多台设备登同一账号自动合并。旧 IrsOaLbj 里如有未同步的录音，
  先在旧链接登录让它同步到本机，再到 ig9wrp 登录上传即可接续。

## 二、为什么主链接永远不变

主链接是 GitHub Pages，地址由 GitHub 账号 + 仓库名决定：
`ericzhang0105.github.io` + `EricPokelearn`。只要账号和仓库在，地址就不会变，
和在哪台机器、哪个目录发布完全无关。

更新链路：`改代码 → git push origin main → GitHub Pages 自动重新部署 → 链接内容更新`。
Service Worker 对 HTML/JS/CSS 走网络优先，孩子设备打开即拿新版（最多下拉刷新一次）。

## 三、任何机器更新的标准流程

**唯一允许的发布方式：git push 到 GitHub。** 不要用 WorkBuddy「发布为应用」重新发布 PokeLearn。

首次在新机器上：
```bash
git clone https://github.com/ericzhang0105/EricPokelearn.git
cd EricPokelearn
```

之后每次更新：
```bash
# 1. 先同步别人的改动（换机器/换会话必做，避免覆盖）
git pull origin main

# 2. 改代码……

# 3. 若改了 js / css / html / 音频 / 图片，先升缓存版本（改 sw.js + package.json）
node tools/bump_version.js       # 仅静态资源变动时需要；只改文档可跳过

# 4. 一键发布（校验仓库地址 + 提交 + push）
bash tools/publish.sh "这次更新的一句话说明"
```

`publish.sh` 会先校验 origin 是否指向正确仓库，防止 push 错地方；然后 commit + push。
push 完成后 Pages 在 1–2 分钟内自动更新，链接地址不变。

## 三之二、换机器（家里 Mac ↔ 公司 Windows）会不会换链接

**主链接：永不换、任何机器都自动最新。** 地址只由 GitHub 账号 + 仓库名决定，与在哪台机器、
什么系统、哪个目录改代码完全无关。公司 Windows 电脑 `git clone / pull → 改代码 → git push`
后，Pages 1–2 分钟自动更新到最新版，地址不变，绝不会生成新链接。

**云链接：只要不点「发布为应用」，地址就永不换。** 分两种情况：
- 公司 Windows 只做 clone / pull / 改代码 / push：云链接地址不受影响。
- 公司 Windows 上点了 WorkBuddy「**发布为应用**」：**会生成新链接**。
  WorkBuddy 按本机目录 hash 绑定应用，公司电脑目录不同 → 新建应用 → 新域名 → 链接改变。
  这是换机器时**唯一必须避免的操作**。

**云链接内容不会随 GitHub push 自动更新。** 它是一次性静态部署，只在这台 Mac
（目录 `/Users/eric.zhang/WorkBuddy/PokeLearnCloud`）重新发布才更新。但要注意：
- 孩子日常学习全在主链接，push 后即最新，完全不受影响；
- 云链接只作登录 / 数据同步入口，账号与数据存在云端数据库，静态页面旧一两版
  不影响登录和同步（云 SDK 从 CDN 加载，接口跟域名走，与页面版本无关）；
- 若希望云链接界面也显示最新版，回到这台 Mac 说一声即可重发（地址不变）。

**一句话结论**：公司电脑随便改、随便 push，主链接一定最新且地址不变；唯一红线是
**不要在公司电脑上点 WorkBuddy「发布为应用」**。

## 四、发布后如何确认生效

- 主链接打开后，家长端底部显示版本号（如 `v63 · 2026-11-17`）
- 命令行核对线上版本：`curl -s https://ericzhang0105.github.io/EricPokelearn/js/cloud-config.js | grep POKELEARN_BUILD`
- iPad 若还是旧内容：Safari 下拉刷新，或关掉 Web Clip 重开一次

## 五、iPad 安装哪个包

从主链接下载 **PokeLearn-iPhone-iPad-Web.mobileconfig**（网页版，指向永久主链接，自动更新）：
```
https://ericzhang0105.github.io/EricPokelearn/PokeLearn-iPhone-iPad-Web.mobileconfig
```
云同步版安装包指向云链接，一般不需要；除非那台 iPad 专门用来登录同步数据。

## 六、禁止事项（做了就会让链接变 / 同步失效）

1. 不要用 WorkBuddy「发布为应用」重新发布 PokeLearn（会按本机目录新建应用 → 换链接）
2. 不要改 GitHub 仓库地址或仓库名
3. 不要在 GitHub Settings 里改 Pages 的发布来源
4. 不要新建 WorkBuddy 应用去「替代」旧链接
5. 不要删 cloud-config.js 里 `CLOUD_HOST` / `CLOUD_APP_URL` / `publishableKey`（云登录依赖它们）

## 七、故障排查

- **push 了但链接没变**：等 1–2 分钟；GitHub 仓库 Settings → Pages 确认来源为 `main` 分支；
  清浏览器缓存或 SW 缓存后重开。
- **iPad 装好后内容旧**：Web Clip 是网页快捷方式，内容永远跟主链接走；下拉刷新即可。
- **云同步登不上**：确认用的是带完整 sharecode 的云同步链接；云同步只在 `app.workbuddy.host` 域名下可用，主链接点登录会自动跳转。
