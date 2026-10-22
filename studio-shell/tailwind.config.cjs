const donor = require('./vendor/tailwind.config.cjs');
module.exports = {
  ...donor,
  content: ['./index.html', './src/**/*.{js,jsx}', './vendor/src/**/*.{js,jsx,mjs}'],
};
