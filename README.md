# 情报驱动的 AI 面试备战系统

> **先聚合这家公司/岗位怎么考，再结合简历和 JD 针对性模拟，最后告诉你哪里没准备好、下一步只练什么。**

相比传统 AI 面试官，差异是两件事：**情报驱动**，以及用**确定性降低焦虑**（不是心理陪伴机器人）。

面向准备大厂技术类实习面试的本科生。

## 它解决什么问题

备考焦虑来自三个「不知道」：不知道考什么、不知道自己什么水平、不知道下一步干什么。

产品不提供情绪安慰。它把不确定变成可以核对的事实，例如：

> 高频考点 18 个，你已经验证掌握 12 个；今天只补这 3 个。

## 主流程

```
目标岗位（公司 / 岗位 / JD / 简历）
        ↓
面试情报（粘贴 / 文件 / URL / 自动检索）
        ↓
岗位情报总结（高频考点 + 真实问题 + 来源）
        ↓
针对训练（完整模拟 / 情报针对训练）
        ↓
复盘（已验证 / 经不起追问 / 尚未覆盖）
        ↓
下一步只练 3 个
```

面试提纲是系统内部产物，不单独占一个阶段。

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
| `/` | 产品首页 |
| `/interview` | 备战项目（目标岗位 → 情报 → 训练 → 复盘） |

`/prepare`、`/analyze` 会重定向到 `/interview`。

### 验证

```bash
npm test                          # 纯函数单元测试
node scripts/smoke.mjs            # 判定引擎端到端冒烟
node scripts/smoke-syllabus.mjs   # 考纲聚合链路冒烟
```

## 技术栈

- Next.js 16 App Router + TypeScript + Tailwind CSS 4
- DeepSeek（`deepseek-chat`），判定类调用一律 temperature 0
- 练习记录存浏览器 localStorage，不上传服务器
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
- 仓库内的示例数据全部为虚构内容，不含任何真实用户信息

## 目录

```
app/                         页面与 API 路由
app/interview/components/   备战流程拆分后的 UI
lib/types.ts                 全部数据结构定义
lib/engine/                  分析引擎：判定、考纲聚合、权重、准备度、追问
lib/samples.*                示例面经
scripts/                     端到端冒烟脚本
deploy/                      部署脚本与服务配置
docs/PRD.md                  需求文档
```

## AI 使用说明

本项目在 Cursor 中开发，代码由 AI 辅助生成，产品判断、方向取舍与验收标准由人确定。详细分工见 `docs/PRD.md` 与提交历史。
