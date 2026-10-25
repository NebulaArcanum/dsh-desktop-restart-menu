# dsh-desktop-restart-menu

中文 | [English](README.en.md)

给 DeepSeek Harness 桌面端补两个「重启」入口：

- **左上角「应用」菜单**：在「退出」上方新增「重启 / Restart」。
- **任务栏托盘图标右键菜单**：在「退出 DeepSeek Harness」上方新增「重启 DeepSeek Harness」。

## 为什么不是插件

这两个原生菜单由 Electron 主进程 `lib/main.js` 构建，而 Cordis 插件运行在独立的 Host 子进程里，拿不到 Electron 的 `Menu` / `Tray` 对象，也没有对外的菜单扩展点。

所以这里直接给 `resources/app.asar` 里的 `lib/main.js` 打补丁：补丁后的 bundle 被裁/补到与原始文件**完全相同的字节长度**，asar 头和条目偏移保持不变。该构建的 Electron asar 完整性校验 fuse 处于关闭状态，等长写回不会触发校验。

## 一键安装 / 卸载（Windows）

- 双击 **`install.cmd`**：自动查找安装位置并打补丁；按提示完全退出应用再打开即可。
- 双击 **`uninstall.cmd`**：还原原始 `lib/main.js`；重启应用后「重启」入口消失。
- 也可以在终端里带路径运行，例如 `install.cmd "D:\...\app.asar"`。
- 需要 Node.js；脚本会先检查，没装时提示下载地址。应用装在 `Program Files` 时可能需要右键「以管理员身份运行」。
- 卸载依赖安装时生成的 `backup/main.orig.mjs`，请不要删除本目录。

## 命令行用法

需要 Node.js（脚本只用到 Node 内置模块）。

```powershell
node apply.js                    # 自动查找安装位置
node apply.js "D:/Programs/DeepSeek Harness/resources/app.asar"  # 手动指定路径
node apply.js --dry-run          # 只做匹配和语法校验，不写入
node restore.js                  # 用打补丁前保存的 backup/main.orig.mjs 还原
```

不打路径时会自动探测常见安装位置（`%LOCALAPPDATA%\Programs`、`Program Files`，以及各盘符下的 `Programs` / `Apps` 等目录）；找不到时会列出尝试过的路径，并提示手动传入。找安装目录的方法：开始菜单里右键 DeepSeek Harness → 打开文件所在的位置，再进入 `resources`。

打完补丁后请**完全退出**应用（托盘 →「退出 DeepSeek Harness」）再重新打开，新菜单从下次启动开始生效。

## 行为

打补丁后的「重启」会执行 `app.relaunch()` + 静默退出（跳过「有任务在运行」的确认框），与官方开发模式里的 Restart 一致：

- 应用菜单项与托盘项都调用同一套 `app.relaunch()` / `quitWithoutConfirmation()`。
- 托盘菜单通过 `DesktopTray` 新增的 `restart` 选项回调，避免退出过程中重复触发。

## 注意

- **应用更新会替换 `app.asar`**，补丁随之消失；升级后重新运行 `apply.js` 即可。
- 脚本按锚点文本打补丁，只支持编写时对应的 shell 版本；锚点匹配数不为 1 时会直接报错退出，不会写入坏文件。
- 写入前会用 asar 头部记录的 SHA-256 校验读出的 `lib/main.js`，布局不符时拒绝写入，避免写坏文件。
- `apply.js` 首次运行会把原始 `lib/main.js` 备份到 `backup/main.orig.mjs`；该目录和生成的 `main.patched.mjs` 已在 `.gitignore` 中，不随仓库分发。
- 还原依赖同一版本的备份；版本不一致时 `restore.js` 会拒绝执行。

## 验证

- 补丁后从 asar 读回的 `lib/main.js` 与本地补丁文件逐字节一致（SHA-256 相同）；
- `node --check` 语法检查通过；
- 重复运行 `apply.js` 会识别「已打补丁」并跳过；
- 菜单视觉效果需在重启应用后确认（补丁进程无法热加载 Electron 主进程代码）。
