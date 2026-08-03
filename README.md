# FAL Workbench

[简体中文](#简体中文) | [English](#english)

> An unofficial, local, schema-driven visual workbench for browsing and running fal.ai models.
>
> 非官方社区项目，与 fal.ai 不存在隶属、授权或背书关系。模型推理由 fal.ai 云端执行，使用产生的费用由 fal.ai 账户承担。

## 简体中文

FAL Workbench 是一个运行在本机浏览器中的 fal.ai 可视化工作台。它读取实时模型目录与 OpenAPI Schema，动态生成参数表单，并把模型选择、请求配置、并发任务、历史结果和本地输出归档集中在一个页面中，无需为每个模型单独维护固定界面。

浏览器负责界面和站点偏好，本地 Node.js 服务负责访问 fal.ai、保存连接与代理设置、跟踪队列任务、代理输出下载并管理自动归档。模型推理由 fal.ai 云端执行。服务默认只监听 `127.0.0.1:14726`。

### 主要功能

#### 模型目录与请求编辑

- 浏览、搜索和分类查看 fal.ai 在线模型；目录采用分页加载，不会停在首批 30 个模型。
- 普通目录模型可直接拖放排序，不显示额外移动按钮；顺序自动保存在浏览器站点数据中。跨分页移动同样会持久化：从后续页面移入前 30 位的模型，刷新后无需再次加载该页，即可继续显示在保存的位置。
- 可搜索并设置启动首选模型，也可一键恢复原始预设。首选模型即使尚未出现在已加载目录页中，也会固定显示在目录顶部。
- `重试` 或 `复制请求` 恢复出的临时模型独立置顶：临时模型位于第 1 位、首选模型位于第 2 位；离开临时模型后，首选模型回到第 1 位。两者相同时只显示一个条目。
- 根据模型 OpenAPI Schema 自动生成可视化参数表单，同时保留完整 JSON 编辑模式和请求预览。
- 支持本地文件上传与 URL 附件；参考图按列表顺序写入请求，并显示 `#image1`、`#image2` 等对应关系。
- 每个模型分别保留当前页面会话中的提示词、附件和请求参数。切换模型或任务完成不会清空输入；只有使用“清除输入”才会恢复该模型的 Schema 默认值。

#### 任务、并发与历史

- 支持直接提交和队列任务；一个任务生成期间仍可继续提交其他队列任务。
- 单个任务可在主结果区持续显示状态和输出；进入多任务模式后，各任务在历史区独立更新，全部结束后主结果区恢复为“暂无任务生成”。
- 历史任务直接在历史列表内展开，不会把结果同步覆盖到主结果区。
- 支持状态轮询、手动刷新、取消、响应 JSON、运行日志和实际生成耗时冻结。
- 重试会恢复原模型与完整请求配置；复制请求可把历史配置载入左侧编辑区。
- 浏览器原生通知和页面 Toast 会分别报告任务完成或失败。点击多任务通知会打开历史区中的对应任务。
- 主结果可单独关闭而不删除任务、取消运行或移除归档文件。

#### 输出、归档与本地体验

- 可预览图片、视频、音频和普通文件；历史视频优先使用 fal.ai 返回的封面，否则尝试解码视频帧作为缩略图。
- 单击结果区或历史展开区中的图片，会在当前页面的半透明蒙版中显示完整大图；原有“打开原始文件”和“另存为”操作保持独立。
- 完成的输出自动归档到 `images/<model>/`。删除任务时，可选择只删除该任务受管理的自动归档；浏览器另存为文件不会被删除。
- 支持浏览器原生保存位置选择器。若浏览器不支持，则使用普通下载；下载统一经过同源 Workbench 接口，并在本地归档不可用时由服务端回源，避免大型视频受到浏览器 CORS 限制。
- fal.ai API Key 可通过界面保存到本机 `.runtime/`，服务重启后自动恢复，也可由进程环境变量 `FAL_KEY` 提供。
- 支持 HTTP、HTTPS 和 SOCKS5 代理设置及连接测试。
- 顶部只读显示 fal.ai Credits 余额；任务进入成功或失败终态后刷新一次，支持负余额，不提供充值或账户操作。
- Windows 提供独立的 `start-demo.bat` 与 `stop-demo.bat`，无需通过任务管理器结束服务。

### 系统要求

- Node.js 20 或更高版本
- npm
- 现代版 Chrome 或 Edge（浏览器通知与原生保存位置选择器取决于浏览器支持）
- fal.ai API Key（浏览模型和 Schema 不需要；提交、上传及查询任务需要；读取账户余额需要 Admin scope）
- 与当前平台匹配的 `genmedia` v0.7.0 可执行文件

### 安装

```powershell
git clone https://github.com/qjj2020another/fal-playground.git
cd fal-playground
npm install
```

把 `genmedia` v0.7.0 放入项目的 `tools` 目录：

```text
tools/
  genmedia.exe    # Windows
  genmedia        # macOS / Linux
```

`tools/genmedia.exe` 体积超过 GitHub 普通 Git 的单文件限制，因此不会随源码仓库提交。请从其官方发行渠道取得对应平台版本。不要从不可信来源下载二进制文件。

### 启动

Windows 用户可以双击：

```text
start-demo.bat
```

停止后台服务：

```text
stop-demo.bat
```

也可以在任意平台使用终端：

```powershell
npm start
```

打开 <http://127.0.0.1:14726>。

如需更换端口：

```powershell
$env:PORT=14727
npm start
```

### 连接 fal.ai

模型目录、搜索、分类及 Schema 表单无需 API Key。实际提交、上传和任务状态查询需要连接 fal.ai。

可以在页面右上角打开连接窗口，粘贴并验证 API Key。验证成功后，密钥保存到本机项目的 `.runtime/` 目录，服务重启后会自动恢复；只有在连接窗口主动断开时才会删除。

也可以通过环境变量提供：

```powershell
$env:FAL_KEY="your-fal-key"
npm start
```

环境变量中的密钥不会被界面的“断开当前连接”删除。

顶部余额栏调用 fal.ai Platform API 的 `GET /v1/account/billing?expand=credits`。fal.ai 要求该接口使用 Admin-scoped API Key。普通 API Key 仍可用于其权限范围内的模型生成；如果它没有账户账单读取权限，余额栏会显示 `--`，不会阻断提交、上传或任务轮询。

### 本地数据

这些目录只属于本机运行数据，不应提交到 Git：

| 路径 | 内容 |
| --- | --- |
| `.runtime/` | 保存的 API Key、代理设置、临时上传与任务归档清单 |
| `images/` | 自动归档的模型输出 |
| `test-artifacts/` | 本地测试截图和临时产物 |
| `node_modules/` | npm 安装的依赖 |
| `tools/genmedia*` | 本机平台使用的外部可执行文件 |

浏览器端任务历史、删除与清除确认偏好、结果区关闭状态、通知开关、模型拖放顺序和启动首选模型都保存在当前站点的 `localStorage` 中。清除该站点的 Cookie／网站数据后，这些浏览器侧记录会恢复默认；项目目录中的 `.runtime/` 与 `images/` 不会因此删除。

当前版本的提示词、附件和请求参数草稿按模型保留在页面内存中，用于当前网页会话内切换模型；重新载入网页后不恢复这些未提交草稿。

### 浏览器通知

页面右上角的“通知”开关会请求浏览器权限。页面保持打开时，任务完成或失败会发送一次原生系统通知；点击通知会聚焦 Workbench 并打开对应任务。页面关闭后，本地轮询停止，不会继续发送通知。

### fal.ai 余额

成功连接后，Workbench 会读取一次当前 Credits 余额；此后每个图片或视频任务首次进入成功或失败终态时，再查询一次。余额栏只显示 fal.ai 返回的余额和币种，美元示例为 `Credits: $4.36`，负余额示例为 `Credits: -$1.25`。

余额栏没有点击、充值、跳转或账户管理功能。鼠标悬停或键盘聚焦时会显示提示，余额不足需前往 fal.ai 处理。余额查询失败不会弹出额外页面，也不会影响任务台的其他功能。

### 输出归档与删除

完成的任务输出会下载到项目根目录的 `images` 下，并按模型分目录保存。删除任务时，只有启用“同时删除项目归档文件”才会删除该任务受管理的归档文件。通过浏览器“另存为”单独导出的文件不属于受管理归档，不会被删除。

### 验证

```powershell
npm test
```

测试命令会检查服务端和前端脚本语法，并运行项目自带的 smoke test 与图像尺寸规则测试。运行测试前应确保 `tools` 中存在匹配平台的 `genmedia` 可执行文件。

### 安全说明

- 不要提交 `.runtime/`、`.env`、生成输出或任何真实 API Key。
- Workbench 只监听回环地址；不要在没有额外认证和安全审查的情况下把它暴露到公网。
- 上传给模型的文件及生成请求会发送到 fal.ai。请遵守 fal.ai 的条款、模型许可和适用法律。
- 安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要在公开 Issue 中发布密钥或漏洞细节。

### 贡献

提交 Issue 或 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 当前状态

当前版本定位为本地开发者预览版，主要在 Windows 与 Chrome/Edge 环境中使用。macOS、Linux 以及不同浏览器尚未经过同等程度的验证。

### 许可证

本项目采用 [MIT License](LICENSE)。第三方组件和 `genmedia` 可执行文件遵循各自的许可条款。

## English

FAL Workbench is an unofficial, local, schema-driven browser interface for fal.ai. It reads the live model catalog and OpenAPI schemas, builds request forms dynamically, and keeps model selection, request editing, concurrent tasks, history, previews, and managed output archives in one workspace.

The local Node.js service listens on `127.0.0.1:14726` by default. It handles fal.ai access, persisted connection and proxy settings, queue polling, same-origin downloads, and managed archives. Inference runs on fal.ai and may incur charges on the connected account.

### Features

#### Model catalog and requests

- Search, filter, and page through the live fal.ai catalog instead of stopping after the first 30 models.
- Drag regular catalog cards to reorder them. The order is saved in this browser's site data without visible move controls. Cross-page moves persist as well: a model moved from a later page into the first 30 positions remains visible there after reload without loading that page again.
- Search for a preferred startup model, change it at any time, or restore the original default. The preferred model remains pinned even before its normal catalog page has loaded.
- Retry and Copy Request may pin a separate temporary model above the preferred model. Leaving that restored request removes the temporary pin; if both identities match, only one card is shown.
- Generate visual forms from OpenAPI schemas while retaining a full JSON editor and request preview.
- Add local uploads or URL assets. Reference-image order is preserved and exposed as `#image1`, `#image2`, and so on.
- Keep prompt, asset, and parameter drafts per model while the page remains open. Model switching and task completion do not clear them; Clear Inputs restores the current schema defaults.

#### Tasks and history

- Run direct requests or queued jobs, continue adding queued jobs while another task is running, poll status, refresh, and cancel supported jobs.
- Use the main result panel for a single task. Concurrent tasks update independently inside History, and the main panel returns to its empty state after the batch ends.
- Expand historical tasks in place without mirroring them into the main result panel.
- Retain response JSON, logs, queue position, and the frozen elapsed time of completed tasks.
- Retry with the original model and complete request, or load a historical request back into the editor.
- Receive in-page toasts and optional native browser notifications for completion and failure. Clicking a multi-task notification opens the matching history entry.
- Dismiss the current main result without deleting history, archives, or an active job.

#### Outputs and local operation

- Preview image, video, audio, and file outputs. Historical video rows use a returned poster when available and otherwise attempt to decode a frame.
- Click a generated image in the main result or expanded history to open an in-page full-image lightbox. Open Original and Save As remain separate actions.
- Archive completed outputs under `images/<model>/`. Managed deletion can remove only that task's archive files; separately exported files remain untouched.
- Save through the browser's native file picker when available. Downloads use a same-origin Workbench endpoint with a server-side remote fallback, avoiding browser CORS failures on large video files.
- Persist a validated fal.ai API Key under `.runtime/`, or provide `FAL_KEY` through the process environment.
- Configure and test HTTP, HTTPS, or SOCKS5 proxies.
- Show a read-only fal.ai Credits balance, including negative balances, and refresh it when a task first reaches a completed or failed state.
- Start and stop the background service on Windows with `start-demo.bat` and `stop-demo.bat`.

### Requirements

- Node.js 20 or newer
- npm
- A current Chrome or Edge release; native notifications and the save-location picker depend on browser support
- A fal.ai API Key for submissions, uploads, and task-status requests; billing access requires an Admin-scoped key
- A platform-compatible `genmedia` v0.7.0 executable

### Install and start

```powershell
git clone https://github.com/qjj2020another/fal-playground.git
cd fal-playground
npm install
```

Place the platform-appropriate executable in `tools/`:

```text
tools/
  genmedia.exe    # Windows
  genmedia        # macOS / Linux
```

The binary is intentionally excluded from Git. Obtain it from its official distribution channel.

Start the service:

```powershell
npm start
```

Open <http://127.0.0.1:14726>. Windows users may run `start-demo.bat` and later stop the independent background service with `stop-demo.bat`.

Model browsing and schema inspection work without a key. Connect through the UI for uploads and generation, or set `FAL_KEY` before starting the service.

### Storage

The following paths are local runtime data and are ignored by Git:

| Path | Purpose |
| --- | --- |
| `.runtime/` | Saved API Key, proxy settings, temporary uploads, and archive manifests |
| `images/` | Automatically archived model outputs |
| `test-artifacts/` | Local screenshots and temporary test output |
| `node_modules/` | Installed npm dependencies |
| `tools/genmedia*` | Platform-specific external binaries |

Task history, confirmation preferences, dismissed-result state, notification settings, drag order, and the preferred model are stored in site-local `localStorage`. Clearing site data restores these browser-side settings. Per-model unsubmitted drafts currently live only for the open page session and do not survive a reload.

### Credit balance

The indicator calls `GET /v1/account/billing?expand=credits`, which fal.ai restricts to Admin-scoped API Keys. A regular key may still run models within its permissions, but the indicator shows `--` when billing access is unavailable. The indicator is display-only, supports negative balances, and exposes no billing or recharge action.

### Verification

```powershell
npm test
```

This checks the server and client scripts, then runs the included smoke test and image-size rule tests. A matching `genmedia` executable must be present in `tools/`.

### Security and project status

FAL Workbench is a single-user local preview. Do not expose it directly to a LAN or the public internet without adding authentication, transport security, origin controls, rate limits, and a separate security review. Do not commit `.runtime/`, real keys, private prompts, generated media, or platform binaries. See [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

Windows with Chrome or Edge is the primary development environment. macOS, Linux, and other browsers have not received equivalent verification.

### License

This project is available under the [MIT License](LICENSE). Third-party components and `genmedia` remain subject to their own terms.

### Disclaimer

This is an unofficial community project. It is not affiliated with, authorized by, or endorsed by fal.ai. fal.ai names and services belong to their respective owners.
