module.exports = {
  apps: [
    {
      name: 'cinema-backend',
      script: 'src/app.js',
      instances: 'max',        // CPU core soni bo'yicha
      exec_mode: 'cluster',    // Cluster mode — 10K request
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
