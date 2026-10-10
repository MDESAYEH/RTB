// pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "roadtobal",
      cwd: "/var/www/roadtobal",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3000",
      env_file: "/var/www/roadtobal/.env.production",
      env: { NODE_ENV: "production" },
      max_memory_restart: "700M",
      autorestart: true,
    },
  ],
};
