#!/usr/bin/env bash
#
# 首次部署脚本。在全新的 Ubuntu 22.04/24.04 服务器上以 root 执行。
#
#   bash setup.sh <域名> <git仓库地址> <DeepSeek API Key>
#
# 服务器地域必须选香港或新加坡：国内地域绑定域名走 80/443 需要 ICP 备案，
# 而本项目对 HTTPS 有硬性依赖。

set -euo pipefail

DOMAIN="${1:?用法: bash setup.sh <域名> <git仓库地址> <DeepSeek API Key>}"
REPO="${2:?缺少 git 仓库地址}"
API_KEY="${3:?缺少 DeepSeek API Key}"

APP_DIR=/opt/diqi

echo "==> 安装系统依赖"
apt-get update -qq
apt-get install -y -qq curl git debian-keyring debian-archive-keyring apt-transport-https

echo "==> 安装 Node.js 22"
if ! command -v node >/dev/null 2>&1; then
	curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
	apt-get install -y -qq nodejs
fi
node -v

echo "==> 安装 Caddy"
if ! command -v caddy >/dev/null 2>&1; then
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		>/etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
fi

echo "==> 拉取代码"
if [ -d "$APP_DIR/.git" ]; then
	git -C "$APP_DIR" fetch --all && git -C "$APP_DIR" reset --hard origin/main
else
	git clone "$REPO" "$APP_DIR"
fi

echo "==> 写入评委 SSH 公钥"
# 交付硬要求：评委需要登录服务器查看运行环境与最后部署时间，无法登录视为产品无法访问
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
while read -r key; do
	[ -z "$key" ] && continue
	grep -qF "$key" /root/.ssh/authorized_keys || echo "$key" >>/root/.ssh/authorized_keys
done <"$APP_DIR/deploy/judge_keys.pub"
chmod 600 /root/.ssh/authorized_keys
ssh-keygen -l -f /root/.ssh/authorized_keys

echo "==> 写入环境变量"
ENV_FILE="$APP_DIR/.env.local"
EXISTING_TAVILY=""
EXISTING_BOCHA=""
if [ -f "$ENV_FILE" ]; then
	EXISTING_TAVILY="$(grep -E '^TAVILY_API_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
	EXISTING_BOCHA="$(grep -E '^BOCHA_API_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
fi
{
	echo "DEEPSEEK_API_KEY=$API_KEY"
	echo "DEEPSEEK_MODEL=deepseek-chat"
	[ -n "$EXISTING_TAVILY" ] && echo "TAVILY_API_KEY=$EXISTING_TAVILY"
	[ -n "$EXISTING_BOCHA" ] && echo "BOCHA_API_KEY=$EXISTING_BOCHA"
} >"$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> 构建"
cd "$APP_DIR"
npm ci
npm run build

echo "==> 配置 systemd"
sed "s|/opt/diqi|$APP_DIR|g" "$APP_DIR/deploy/diqi.service" >/etc/systemd/system/diqi.service
systemctl daemon-reload
systemctl enable --now diqi
systemctl restart diqi

echo "==> 配置 Caddy"
sed "s|example.com|$DOMAIN|g" "$APP_DIR/deploy/Caddyfile" >/etc/caddy/Caddyfile
mkdir -p /var/log/caddy
systemctl reload caddy || systemctl restart caddy

echo
echo "==> 完成。请验证："
echo "    curl -I https://$DOMAIN"
echo "    systemctl status diqi --no-pager"
