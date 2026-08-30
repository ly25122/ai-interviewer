# 情报驱动 面试备战

实习、夏令营都可以。一场一场摸清怎么考，再对照简历练；不是随机刷题。

- 线上：https://8.219.189.79.sslip.io/
- 演示：https://8.219.189.79.sslip.io/interview?demo=1
- 仓库：https://github.com/ly25122/ai-interviewer
- Product Memo：[`docs/PRODUCT_MEMO.md`](docs/PRODUCT_MEMO.md)

面向准备实习或夏令营面试的本科生。去向不一定是公司，常常一场接一场。

## 评委验收

| 项 | 说明 |
|---|---|
| 产品链接 | https://8.219.189.79.sslip.io/ ，无需登录 |
| 演示 | 首页「演示模式」，或 `/interview?demo=1`（不写历史） |
| SSH | `ssh -i <评委私钥> root@8.219.189.79`（22 端口）。两把评委公钥已写入 `/root/.ssh/authorized_keys`。项目目录 `/opt/diqi`，服务 `systemctl status diqi`。最后部署时间见该目录 `git log -1` |
| 仓库 | 本仓库 public；commit history 按功能迭代，非一次性提交 |

## 它解决什么问题

备考焦虑来自三个「不知道」：不知道这场考什么、不知道自己什么水平、不知道下一步干什么。

产品不提供情绪安慰。它把不确定变成可以核对的事实，例如：

> 高频考点 18 个，已验证 12 个；今天只补这 3 个。

## 主流程

```
这场面试（去向 / 方向 / 简历 / 选拔要求）
        ↓
面试情报（公开收集 / 手动加入）
        ↓
考情画像（高频考点 + 简历匹配）
        ↓
针对训练（完整模拟 / 情报针对训练）
        ↓
复盘（已验证 / 经不起追问 / 尚未覆盖）
        ↓
下一步只练 3 个
```

1. **这场面试**：填写去向（公司、学校或夏令营）和方向，粘贴或上传简历与选拔要求（PDF / DOCX / TXT / MD）。
2. **面试情报**：公开收集（自动检索、链接抓取）或手动加入（整理粘贴、上传文件）。每条可标可信度。条数太少、又对不上这场面试时，不会硬画一张图。
3. **考情画像**：把情报聚成高频考点，并对照简历给出匹配情况。
4. **针对训练**：先定时长、题量和难度（舒适 / 常规 / 加压）。完整模拟覆盖四类题源；情报针对训练只练这场反复出现的点。
5. **复盘**：本场问答、历史面试、简历诊断。列出已站住、被追回来、尚未覆盖的点，并给出下一步三刀。演示模式不写入历史。

### 训练题源

| 标签 | 含义 |
|---|---|
| 面经考点 | 该场面试的面经中出现过，非通用题库抽取 |
| 经历已覆盖 | 选拔要求与简历经历重合，将围绕实际贡献追问 |
| 经历待核实 | 量化结果或职责表述偏满，追问中需给出可核验依据 |
| 要求未覆盖 | 选拔要求有明确条目，简历中缺少对应经历 |

### 难度

| 档 | 问法 |
|---|---|
| 舒适 | 先问做过的部分和成功路径 |
| 常规 | 机制问清后再追一层边界 |
| 加压 | 开场就对质失败路径和数字口径 |

## 运行

需要 Node.js 22 以上。

```bash
npm install
cp .env.example .env.local   # 必填 DeepSeek；可选 TAVILY_API_KEY / BOCHA_API_KEY 提升公开面经检索
npm run dev
```

打开 http://localhost:3000

| 路径 | 用途 |
|---|---|
| `/` | 首页：最近备战与入口 |
| `/interview` | 备战（这场面试 → 情报 → 画像 → 训练 → 复盘） |
| `/interview?demo=1` | 演示模式（字节电商交易组，不写历史） |
| `/history` | 本机往期复盘 |

`/prepare`、`/analyze` 会重定向到 `/interview`。

### 验证

```bash
npm test                          # 纯函数单元测试
node scripts/smoke.mjs            # 判定引擎端到端冒烟
node scripts/smoke-syllabus.mjs   # 考纲聚合链路冒烟
node scripts/smoke-random-flow.mjs
```

## 技术栈

- Next.js 16 App Router + TypeScript + Tailwind CSS 4
- DeepSeek（`deepseek-chat`），判定类调用低温；简历/选拔要求摘录做代码级核验
- 练习与复盘记录存浏览器 localStorage，不上传服务器
- Vitest

## 部署

```bash
bash deploy/setup.sh <域名> <git仓库地址> <DeepSeek API Key>
```

脚本会安装 Node 与 Caddy、写入评委 SSH 公钥、构建并以 systemd 托管、由 Caddy 自动申请 HTTPS 证书。

服务器地域必须选**香港或新加坡**。国内地域绑定域名走 80/443 需要 ICP 备案，而本项目对 HTTPS 有硬性依赖。

## 数据来源与合规

- 产品运行时不向小红书、知乎发起登录或绕过验证码；自动检索只读公开网页，这两站不纳入结果
- 作者标识入库前哈希化，不存储昵称与头像
- 仓库内的示例与演示数据全部为虚构内容，不含任何真实用户信息

## 目录

```
app/                         页面与 API 路由
app/interview/components/     备战流程拆分后的 UI
lib/types.ts                 全部数据结构定义
lib/engine/                  分析引擎：判定、考纲聚合、权重、准备度、追问
lib/interview-demo.ts        演示模式材料
lib/samples.*                示例面经
scripts/                     端到端冒烟脚本
deploy/                      部署脚本、评委公钥、服务配置
docs/PRODUCT_MEMO.md         提交用 Product Memo（1–2 页）
docs/PRD.md                  开发期需求记录
```

## AI 使用说明

本项目在 Cursor 中开发，代码由 AI 辅助生成；产品判断、方向取舍与验收标准由人确定。出题与追问使用 DeepSeek。分工见 `docs/PRODUCT_MEMO.md` 第 5 节与提交历史。
