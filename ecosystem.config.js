module.exports = {
  apps : [{
    name      : 'CPPG-Inst',
    script    : 'bin/www',
    env: {
      NODE_ENV: 'development'
    },
    watch: true,
    ignore_watch: ['public','node-modules'],
    followAllRedirects: true,
    env_production : {
      NODE_ENV: 'production'
    }
  }],

  deploy : {
    production : {
      user : 'node',
      host : '212.83.163.1',
      ref  : 'origin/master',
      repo : 'git@github.com:repo.git',
      path : '/var/www/production',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
