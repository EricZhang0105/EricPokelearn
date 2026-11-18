# PokeLearn 永久链接与跨机器发布规范

这份文档是 PokeLearn 发布规则的唯一真相源。任何机器、任何会话更新代码前先看这里。
目的只有一个：**分享链接永远不变，任何一台机器改完代码，打开链接就是最新版。**

## 一、两条链接，各司其职

| 用途 | 永久地址 | 特性 |
|---|---|---|
| 主链接（日常使用 / 分享 / iPad 主屏 / 孩子用） | https://ericzhang0105.github.io/EricPokelearn/ | 地址永不变；任何机器 push 后 1–2 分钟自动更新 |
| 云同步（登录 / 跨设备同步存档与家长录音） | https://wbapp-irsoalbj6c5htbc5ks1cye.app.workbuddy.host/?sharecode=4KAXDGF6AB | 地址永不变；只用于账号与数据同步，页面新旧不影响数据 |

日常一律打开**主链接**。需要登录或跨设备同步时，点页面右上角「👤 登录 / 注册」→
一键跳转到云同步链接。两个链接是同一个 App，数据互通。sharecode 必须完整保留，不能删。

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
