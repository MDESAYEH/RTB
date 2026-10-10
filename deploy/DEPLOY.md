# رفع Roadtobal27.ly على VPS (Ubuntu)

1. DNS: سجل A لـ `roadtobal27.ly` و`www` يشير إلى IP السيرفر.
2. تجهيز السيرفر:
   ```
   apt update && apt install -y nginx certbot python3-certbot-nginx git ufw
   curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt install -y nodejs
   npm i -g pm2
   ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
   ```
3. المشروع:
   ```
   mkdir -p /var/www/roadtobal /var/backups/roadtobal
   # انسخ المشروع (git clone أو scp) إلى /var/www/roadtobal
   # انسخ مجلد data/ (فيه road.db) من جهازك إلى /var/www/roadtobal/data/
   cd /var/www/roadtobal && npm ci && cp deploy/env.production.example .env.production
   nano .env.production     # املأ CRON_SECRET
   set -a; . ./.env.production; set +a
   npm run build
   ```
4. المدير (مرة واحدة، كلمة السر في الطرفية فقط):
   `ADMIN_PASSWORD='...' npm run admin:create`
5. التشغيل: `pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup`
6. nginx:
   ```
   cp deploy/nginx-roadtobal27.conf /etc/nginx/sites-available/roadtobal27.ly
   ln -s /etc/nginx/sites-available/roadtobal27.ly /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   certbot --nginx -d roadtobal27.ly -d www.roadtobal27.ly
   ```
7. cron: `crontab -e` والصق محتوى `deploy/crontab.txt` بعد تعديل السر.
8. تحقق: افتح https://roadtobal27.ly ثم سجل دخول الإدارة وجرب رفع صورة.
9. انسخ `/var/backups/roadtobal` دوريًا إلى خارج السيرفر.

التحديث لاحقًا: `git pull && npm ci && npm run build && pm2 restart roadtobal`.
