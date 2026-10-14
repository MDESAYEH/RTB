# تحصين السيرفر (نفّذه مرة واحدة)

## 1) nginx
```bash
sudo mkdir -p /etc/nginx/snippets
sudo cp deploy/nginx-proxy-snippet.conf /etc/nginx/snippets/roadtobal-proxy.conf
sudo cp /etc/nginx/sites-available/roadtobal27.ly /etc/nginx/sites-available/roadtobal27.ly.bak   # نسخة احتياط
sudo cp deploy/nginx-roadtobal27.conf /etc/nginx/sites-available/roadtobal27.ly
sudo nginx -t && sudo systemctl reload nginx
```
إذا فشل `nginx -t` أعد النسخة الاحتياطية. تأكد من مسارات الشهادة داخل الملف.

## 2) جدار الحماية: 22 و80 و443 فقط
```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

## 3) fail2ban (يحظر من يخمّن كلمة سر SSH أو يغرق nginx)
```bash
sudo apt install -y fail2ban
printf "[sshd]\nenabled = true\nmaxretry = 4\nbantime = 1h\n[nginx-limit-req]\nenabled = true\n" | sudo tee /etc/fail2ban/jail.d/rtb.local
sudo systemctl restart fail2ban
```

## 4) SSH بالمفتاح فقط (بعد التأكد أن مفتاحك يعمل!)
في `/etc/ssh/sshd_config`: `PasswordAuthentication no` و`PermitRootLogin no` ثم `sudo systemctl reload ssh`.

## 5) صلاحيات الملفات
```bash
chmod 600 /var/www/roadtobal/.env.production /home/edu/.fiba-curl
chmod 700 /var/www/roadtobal/data /var/backups/roadtobal
chmod 600 /var/www/roadtobal/data/*.db 2>/dev/null
```

## 6) تحديثات أمنية تلقائية
```bash
sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

## 7) تحقق
```bash
curl -sI https://roadtobal27.ly | grep -iE "strict-transport|content-security|x-frame|permissions"
curl -s -o /dev/null -w "%{http_code}\n" https://roadtobal27.ly/api/cron/fiba   # المتوقع 404
curl -s -o /dev/null -w "%{http_code}\n" http://roadtobal27.ly:3091             # المتوقع فشل الاتصال
```
وغيّر كلمة سر الإدارة إلى كلمة فريدة طويلة (14+ حرفاً) لم تُستخدم في أي مكان آخر: `ADMIN_IDENTIFIER='name@example.com' ADMIN_PASSWORD='...' npm run admin:create` ثم `pm2 restart roadtobal`.

**مهم عند الترقية إلى نظام الحسابات والأدوار:** الحساب القديم (كلمة سر فقط) لن يستطيع الدخول من النموذج الجديد. نفّذ الأمر أعلاه **مباشرة بعد التحديث** لإنشاء حساب المالك بالبريد/الهاتف؛ ينشئ الأمر الحساب ويحذف الحساب القديم تلقائياً ويُلغي جلساته.
