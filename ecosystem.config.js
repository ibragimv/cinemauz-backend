module.exports = {
  apps: [
    {
      name: 'cinema-backend',
      script: 'src/app.js',
      instances: 1,           // Telegram User client uchun faqat 1 ta instansiya kerak
      exec_mode: 'fork',      // Cluster mode Telegram bilan AUTH_KEY_DUPLICATED xatosini beradi
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
