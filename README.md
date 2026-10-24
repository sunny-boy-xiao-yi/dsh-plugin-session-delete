# 插件-删除会话

给 **DeepSeek Harness Desktop v0.2.1-rc.2** 的会话侧边栏加一个真正可用的「删除会话」。

确认后，插件会先停止该会话正在运行的工作，再把它从内存中卸载，并删除本机的会话目录与投影缓存。操作完成后，会话会立即从侧边栏消失。

> **兼容版本：DeepSeek Harness Desktop v0.2.1-rc.2**
> 本项目基于该版本的客户端插槽、Primitives 与应用内 Remote 机制实现，未在其他版本上验证。Harness 升级后若内部接口变化，插件可能需要同步适配。

[更新日志](./CHANGELOG.md) · [许可证](./LICENSE)

---

## 特性

- **原生感的删除确认弹窗**：不是 `window.confirm`，而是使用 Harness 自带的 `Modal`、`Button` 与设计令牌渲染，和宿主界面一致，支持深色/浅色主题。
- **删除前先停活**：通过工作区注册表停止运行中的回合、子智能体、后台任务与定时提醒。
- **真正删除本地数据**：移除会话目录、投影缓存，并针对 Windows 文件句柄延迟做重试。
- **即时反馈**：删除中显示进度，失败在弹窗内提示原因，可重试或取消。
- **零运行时依赖**：纯 ESM，无需构建、无需安装 npm 依赖、不访问外部网络（只通过应用内 RPC 与宿主通信）。

## 界面

确认弹窗由 Harness 自带的 `Modal` 渲染，内容依次为：

- **标题**：删除会话？
- **说明**：“会话名称”将被永久删除，本地会话记录与投影缓存也会一并移除。
- **警示条**：此操作不可恢复。如果该会话仍在运行，会先停止它的所有工作。
- **Session ID**：用于区分同名会话。
- **底部操作**：取消 / 删除（危险色按钮）。

> 欢迎在仓库中补充实际截图。

## 兼容性

| 项目 | 说明 |
| --- | --- |
| DeepSeek Harness Desktop | **v0.2.1-rc.2** |
| 客户端平台 | `web`（桌面版内置的 Web 前端同样加载） |
| 运行环境 | 应用内置 Node.js / Electron 44.7.0 |
| 第三方依赖 | 无 |

> 仅适用于本机 `~/.dsh` 下的会话数据。多设备或云端同步不会同步删除。

## 安装

**安装前提**

- DeepSeek Harness Desktop **v0.2.1-rc.2**（其他版本可能加载成功但侧边栏不出现菜单项）。
- 仓库公开可访问，且根目录包含 `package.json` 与 `cordis.patch.yml`。
- 本机能访问 `github.com`；从 GitHub 安装要求本机已安装 Git（宿主会先执行 `git ls-remote` 检查连通性）。需要代理时请配置 Git 的 `http.proxy` / `https.proxy`。
- 安装完成后默认启用；若界面提示需要重启，重启应用后菜单项才会出现。

### 方式一：插件管理器（推荐）

1. 打开 **插件管理器**。
2. 选择 **安装第三方插件**。
3. 填入本仓库地址：

   ```
   github:<your-github-user>/dsh-plugin-session-delete
   ```

   或使用完整 URL：

   ```
   https://github.com/<your-github-user>/dsh-plugin-session-delete
   ```

4. 安装完成后按提示启用，必要时重启应用。

> GitHub 安装要求仓库**根目录**就是本插件目录（即 `package.json` 位于仓库根目录），且仓库可公开访问。
>
> 默认安装默认分支的最新提交。仓库打了标签后可以固定版本，例如
> `github:<your-github-user>/dsh-plugin-session-delete#v0.4.1`。
> 升级时先在插件管理器中卸载旧版本，再按新地址安装。

### 方式二：命令行

```bash
dsh plugin --profile desktop add github:<your-github-user>/dsh-plugin-session-delete
```

> 桌面版内置的 `dsh` CLI 默认不在 PATH 中，桌面用户请优先使用插件管理器。

### 方式三：本地目录（开发调试）

在「安装第三方插件」的安装源中填入本目录的**绝对路径**（例如 `E:\plugins\dsh-plugin-session-delete`）。Harness 会以 `link:` 方式引用该目录，修改代码后重载插件或重启应用生效；安装后不要移动或删除该目录。

## 使用

1. 在左侧会话列表中悬停到目标会话。
2. 点击行尾的 `⋯` 菜单。
3. 选择 **删除会话**。
4. 在确认弹窗中核对会话名称与 Session ID，点击 **删除**。

删除期间弹窗不可关闭。失败时会显示宿主返回的原因，数据未被完全删除时可以重试。

## 会删除什么

以 `session-1a2b3c4d` 为例：

| 内容 | 位置 |
| --- | --- |
| 会话日志目录 | `~/.dsh/sessions/<编码后的项目路径>/session-1a2b3c4d/` |
| 投影缓存 | `~/.dsh/storages/session_projcache/sessions/session-1a2b3c4d.json` |
| 运行中的工作 | 回合、子智能体、后台任务、定时提醒（先停止） |
| 置顶 / 归档状态 | 删除前先归档（同时清除置顶），删除后清理归档标记 |

Windows 上文件句柄可能延迟释放，插件会在 0ms / 250ms / 1200ms 重试，并在 1.5 秒后再执行一次补偿清理。

**此操作不可恢复。** 删除前请确认该会话不再需要。

## 工作原理

```
侧边栏 ⋯ 菜单
   │  选择「删除会话」
   ▼
客户端插件 lib/client.js
   │  shell.overlay 弹窗确认
   ▼
POST /api  sessionTrash/deleteSession  { args: { sessionId } }
   ▼
宿主插件 lib/index.js（SessionTrashService）
   ├─ workspaceRegistry.archiveSession(id, { stopActivity: true })   停止运行中的工作
   ├─ sessions.detachEntered(...)                                    卸载内存会话
   ├─ 删除会话目录 + 投影缓存（含延迟重试）
   └─ workspaceRegistry.unarchiveSession(id)                         清理归档标记
```

- **宿主侧** `lib/index.js`：通过 `typertRemote` 描述符把 `deleteSession(sessionId, signal)` 暴露为 `sessionTrash/deleteSession`，无需代码生成。
- **客户端** `lib/client.js`：向 `sidebar.workspaces.session.menu.item` 注入菜单项，向 `shell.overlay` 注入确认弹窗，通过宿主自带的 RPC 调用删除。

## 安全与隐私

- 会话 ID 会被校验（`^session-[A-Za-z0-9-]{1,64}$`），不会接受路径片段。
- 只操作当前用户 `~/.dsh` 下的会话目录与缓存目录。
- 不采集、不上传任何数据，没有遥测；只通过应用内 RPC 与宿主通信，不访问外部网络。
- 所有删除都在本机完成，失败会返回可读原因。

## 卸载

在插件管理器中卸载本插件即可。

卸载只会移除插件本身，**不会删除已有会话数据**；插件的唯一作用是提供删除入口。

## 已知限制

- 删除不可撤销，没有回收站。
- 仅处理本机会话数据，不涉及远端/云同步。
- 依赖 Harness 未公开的内部接口（插槽、Primitives、Remote 发现机制），升级 Harness 后可能需要适配。
- 仅在 DeepSeek Harness Desktop v0.2.1-rc.2 上验证。

## 目录结构

```
.
├── lib/
│   ├── index.js        # 宿主侧：SessionTrashService 与 Remote 暴露
│   └── client.js       # 客户端：菜单项、确认弹窗、RPC 调用
├── locale/
│   ├── zh.json         # 插件显示名与描述（中文）
│   └── en.json         # 插件显示名与描述（英文）
├── cordis.patch.yml    # 插件装配补丁
├── icon.svg            # 插件图标
├── package.json
├── README.md
├── CHANGELOG.md
├── LICENSE
└── .gitignore
```

## 开发

无构建步骤，修改后重载插件或重启应用即可。

```bash
# 语法检查
node --check lib/index.js
node --check lib/client.js
```

调试建议：

- 宿主侧日志在 Harness 的插件日志中查看，服务名 `sessionTrash`。
- 客户端弹窗通过 `shell.overlay` 渲染，菜单项属于 `sidebar.workspaces.session.menu.item` 插槽。
- 本地安装时 profile 会以 `link:<本目录>` 引用，便于实时修改。

### 发布到 GitHub 检查清单

1. 将 `<your-github-user>` 替换为实际 GitHub 用户名。
2. 确认 `package.json` 中的 `version` 与本次发布一致（当前 `0.4.1`）。
3. 推送后打标签：`git tag v0.4.1 && git push --tags`。
4. README 中的示意图可替换为实际截图。

## 版本

当前版本 **0.4.1**。变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

## 贡献

欢迎提交 Issue 和 Pull Request。提交前请确认：

- 目标版本仍为 **DeepSeek Harness Desktop v0.2.1-rc.2**，或在说明中写明适配版本。
- `node --check lib/index.js` 与 `node --check lib/client.js` 通过。
- 不引入运行时依赖，不增加外部网络请求。
- 删除行为保持「先停活、再删除」，并保留失败提示。

## 许可证

[MIT](./LICENSE)

---

## English

**Delete Session** is a third-party plugin for **DeepSeek Harness Desktop v0.2.1-rc.2**. It adds a *Delete session* action to each conversation's sidebar menu and permanently removes the session from the live store, the local session directory, and the projection cache.

- Stops any running work first, then detaches the session and deletes its local data.
- Uses the host's own modal primitives, so the confirmation dialog follows the app theme.
- No runtime dependencies, no telemetry, and no external network access (it only talks to the host over the app's internal RPC).
- **Irreversible**: deleted sessions cannot be restored.

Install from the Plugin Manager with `github:<your-github-user>/dsh-plugin-session-delete`, or from the CLI:

```bash
dsh plugin --profile desktop add github:<your-github-user>/dsh-plugin-session-delete
```

Requirements: a public repository whose root is this plugin, Git installed on the machine, and network access to `github.com` (configure Git's proxy if needed). Pin a release with `#v0.4.1`, for example `github:<your-github-user>/dsh-plugin-session-delete#v0.4.1`. The CLI is not on PATH in the Desktop build, so Desktop users should use the Plugin Manager.

Tested only against **DeepSeek Harness Desktop v0.2.1-rc.2**. Internal APIs may change in future Harness releases.
