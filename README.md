# Obsidian Viewer for Android

一个面向 Android 的只读 Obsidian Vault 阅读器。项目使用 Kotlin、Jetpack Compose 和系统 Storage Access Framework（SAF），无需申请整个手机存储空间的访问权限。

> 当前版本：`0.2.0`。项目仍处于早期开发阶段，请勿将它视为 Vault 的唯一副本。

## 当前功能

- 通过 Android 系统文件夹选择器连接本地 Vault
- 永久保存用户授予的 Vault 读取权限
- 按原始目录结构浏览文件夹和 Markdown 笔记
- 显示笔记相对路径和最近打开记录
- 搜索文件名与 Markdown 正文
- 支持下拉刷新和按钮刷新
- 跟随系统深色/浅色主题
- 支持笔记跳转历史和 Android 系统返回键

### Markdown 与 Obsidian 语法

- CommonMark 基础语法
- 标题、段落、粗体、斜体和删除线
- 有序/无序列表、任务列表和引用
- 行内代码、代码块和分隔线
- GFM 表格与自动链接
- 外部网页链接
- `[[Wiki Link]]`
- `[[笔记|显示别名]]`
- `[[笔记#标题]]` 标题跳转
- `![[图片.png]]` 和标准 Markdown 图片
- `![[笔记]]` 笔记嵌入
- YAML Frontmatter/Properties
- Obsidian Callout（Note、Tip、Warning、Danger、Success 等）

## 技术栈

- Kotlin
- Jetpack Compose + Material 3
- Android Storage Access Framework
- AndroidX DocumentFile
- CommonMark Java + GFM 扩展
- WebView 本地 HTML 阅读视图
- Gradle Kotlin DSL

Markdown 在设备本地解析。Vault 图片通过 WebView 从已授权的文档 URI 流式读取，避免将大图完整解码进 Compose 内存。

## 环境要求

- Android Studio 2026.1 或兼容版本
- JDK 17 或更高版本（推荐使用 Android Studio 内置 JDK）
- Android SDK 37
- Android SDK Build Tools 36.0.0
- Android 8.0（API 26）或更高版本的设备

项目当前使用：

- Android Gradle Plugin 9.3.0
- Gradle 9.5.0
- Kotlin/Compose Compiler 2.3.21
- Compose BOM 2026.06.00

## 构建项目

克隆仓库：

```bash
git clone https://github.com/MorganTian886/Obsidian_Viewer.git
cd Obsidian_Viewer
```

Windows：

```powershell
.\gradlew.bat assembleDebug
```

macOS/Linux：

```bash
./gradlew assembleDebug
```

生成的 APK 位于：

```text
app/build/outputs/apk/debug/app-debug.apk
```

连接已启用 USB 调试的 Android 设备后，可以运行：

```powershell
.\gradlew.bat installDebug
```

也可以在 Android Studio 中打开项目，选择设备后点击 **Run**。

## 使用方法

1. 在手机上创建或复制一个 Obsidian Vault，例如 `Documents/Obsidian/MyVault`。
2. 打开 App，点击 **选择 Vault**。
3. 进入具体的 Vault 文件夹后点击 **使用此文件夹**。
4. 从文件夹列表打开 Markdown 笔记。

Android 不允许应用直接选择共享存储根目录，因此必须选择一个具体的子文件夹。

## 项目结构

```text
app/src/main/java/com/morgan/obsidianviewer/
├── MainActivity.kt        # Compose UI、文件夹导航和 WebView 阅读器
├── MarkdownRenderer.kt    # Markdown/Obsidian 语法预处理与 HTML 渲染
└── VaultModels.kt         # Vault 索引、文件模型和全文搜索缓存
```

## 隐私与安全

- App 只访问用户通过系统文件选择器明确授权的 Vault。
- Markdown 解析、搜索和图片加载都在本地完成。
- WebView 禁用了 JavaScript。
- 外部链接交给系统浏览器处理。
- GitHub token 使用 Android Keystore 加密后保存在设备上，不写入项目文件或日志。
- GitHub 同步当前仅下载私有仓库，不会向仓库上传 Vault 内容。

## 开发路线

- [x] 本地 Vault 选择与持久权限
- [x] 文件夹导航与全文搜索
- [x] CommonMark/GFM 阅读视图
- [x] Wiki Link、图片、嵌入、Frontmatter 和 Callout
- [x] 深色模式和最近打开
- [ ] 使用真实 Vault 进行兼容性测试
- [x] 私有 GitHub 仓库只读下载与同步状态
- [ ] 后台自动同步
- [ ] 阅读设置、主题和自定义 CSS
- [ ] Mermaid、KaTeX 和代码语法高亮
- [ ] Release APK 与自动化测试

## License

尚未选择开源许可证。在添加许可证之前，保留所有权利。
