# Obsidian Viewer 插件

这个仓库提供原生 Obsidian 插件。插件直接使用 Obsidian 的 vault、Markdown 渲染、链接、Properties、Callout、Mermaid、数学公式、代码高亮和已安装的 Dataview，在桌面端和移动端使用同一套实现。

## 插件功能

- 左侧阅读工作台：首页、文件、收藏、阅读历史
- 文件名与 Markdown 正文搜索
- 当前笔记快捷收藏、设为首页
- 当前笔记目录和标题跳转
- 字号、行距、正文宽度、段落间距设置
- 专注阅读模式
- Quizzable 七种题型、评分、解析、重试和本地进度
- Android、iOS、Windows、macOS、Linux 共用的 GitHub 双向同步
- 自动识别当前设备平台，也支持关闭自动识别后填写自定义设备名称
- fine-grained token 使用 Obsidian SecretStorage 保存，不写入插件配置文件
- 本地与远端三方差异判断、删除同步、冲突副本和自动同步
- 桌面与移动端兼容；阅读、搜索和答题可离线使用

GitHub 同步本身需要连接 GitHub；其余阅读、搜索和答题功能不依赖外部服务。

## GitHub 同步设置

1. 在 GitHub 创建只授权目标仓库的 fine-grained personal access token。
2. Repository permissions 选择 `Contents: Read and write`。
3. 在 Obsidian → 设置 → Obsidian Viewer 中填写 token、`owner/repository` 和分支。
4. 先点击“测试连接”，再执行第一次“立即双向同步”。
5. 验证无误后，再选择是否开启启动时、保存后或定时同步。

首次同步采用安全合并：两端独有文件都会保留；同一路径内容不同会比较本地修改时间与远端该路径最近 commit 时间，较新的版本作为主文件，较旧版本另存为带设备名和时间的 `.conflict-…` 副本。之后同步使用上次 commit 作为共同基线，分别识别本地和远端修改。

同步器通过跨平台 Vault Adapter 枚举文件，因此 `.gitignore`、主题、CSS、社区插件、核心插件启用列表、插件程序、插件 `data.json` 设置和其他有意义的 `.obsidian/` 隐藏内容都会参与三方同步。工作区布局、Viewer 本机同步状态和 Obsidian Git 临时脚本默认按设备保留，避免 Android、iOS、Windows 和 macOS 的运行状态互相覆盖。仅 `.git/` 内部数据库和 `.trash/` 回收站始终忽略；默认忽略项仍可由用户调整。SecretStorage 中的 token 不属于 vault 文件，不会提交。单文件默认上限为 50 MB，超限时会明确停止同步，不会静默跳过。

> 如果 vault 同时安装了 Obsidian Git，请只保留一个自动同步器。两个插件同时自动更新同一分支会产生竞态。

## 构建

```bash
npm install
npm run build
```

构建后，将 `manifest.json`、`main.js` 和 `styles.css` 放入：

```text
<Vault>/.obsidian/plugins/obsidian-viewer/
```

然后在 Obsidian 设置 → 第三方插件中启用 **Obsidian Viewer**。

## Quizzable 示例

````markdown
```quiz
id: example
title: 示例测验
mode: all-at-once
passingScore: 60
questions:
  - id: q1
    type: multiple-choice
    prompt: Obsidian 的笔记默认使用哪种格式？
    options:
      - id: md
        text: Markdown
      - id: docx
        text: Word
    correctAnswer: md
    explanation: Obsidian 以 Markdown 文件作为笔记基础。
```

```playable-quiz
id: example
```
````

支持的 `type`：`multiple-choice`、`true-false`、`multiple-select`、`short-text`、`numeric`、`matching`、`reorder`。
