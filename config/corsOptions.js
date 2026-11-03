const { allowedOrigins } = require('./allowedOrigins');

exports.corsOption = {
  origin: (origin, callback) => {
    // Allow server-to-server or non-browser requests (like Postman or curl)
    if (!origin) {
      return callback(null, true);
    }

    // 1. Exact match in allowedOrigins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 2. Allow subdomains on mylio.site (*.mylio.site)
    if (/^https?:\/\/([a-zA-Z0-9_.-]+\.)?mylio\.site$/i.test(origin)) {
      return callback(null, true);
    }

    // 3. Allow subdomains in local development (*.localhost:3000 or any localhost port)
    if (/^https?:\/\/([a-zA-Z0-9_.-]+\.)?localhost(:\d+)?$/i.test(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
