// Reading process.env variables from .env file
require('dotenv').config();

// Scaffolding Express app
var express = require('express');
var app = express();
var server = require('http').createServer(app);

var bodyParser = require('body-parser');
app.use(bodyParser.json());

// Enabling CORS
var cors = require('cors');
app.use(cors());
app.options('*', cors());

// Setting up detailed logging
var winston = require('winston');
var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      json: true,
      level: 'info' // Set 'debug' for super-detailed output
    })
  ],
  exitOnError: false
});
logger.stream = {
  write: function(message, encoding) {
    logger.info(message);
  }
};
app.use(
  require('morgan')('combined', {
    stream: logger.stream
  })
);

// Setting Web Push credentials
var webPush = require('web-push');
webPush.setVapidDetails(
  'mailto:salnikov@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);
var pushSubscriptions = [];

// Subscribe to Web Push
app.post('/webpush', function(req, res, next) {
  logger.info('Web push subscription object received: ', req.body.subscription);

  if (req.body.action === 'subscribe') {
    if (
      arrayObjectIndexOf(
        pushSubscriptions,
        req.body.subscription.endpoint,
        'endpoint'
      ) == -1
    ) {
      pushSubscriptions.push(req.body.subscription);
      logger.info('Subscription registered: ' + req.body.subscription.endpoint);
    } else {
      logger.info(
        'Subscription was already registered: ' + req.body.subscription.endpoint
      );
    }

    res.send({
      text: 'Web push subscribed',
      status: '200'
    });
  } else if (req.body.action === 'unsubscribe') {
    var subscriptionIndex = arrayObjectIndexOf(
      pushSubscriptions,
      req.body.subscription.endpoint,
      'endpoint'
    );

    if (subscriptionIndex >= 0) {
      pushSubscriptions.splice(subscriptionIndex, 1);

      logger.info(
        'Subscription unregistered: ' + req.body.subscription.endpoint
      );
    } else {
      logger.info(
        'Subscription was not found: ' + req.body.subscription.endpoint
      );
    }

    res.send({
      text: 'Web push unsubscribed',
      status: '200'
    });
  } else {
    throw new Error('Unsupported action');
  }

  logger.info('Number of active subscriptions: ' + pushSubscriptions.length);
});

function sendNotification(pushSubscription, payload) {
  if (pushSubscription) {
    webPush
      .sendNotification(pushSubscription, payload)
      .then(function(response) {
        logger.info('Push sent');
        logger.debug(payload);
        logger.debug(response);
      })
      .catch(function(error) {
        logger.error('Push error: ', error);
      });
  }
}

app.post('/push-hook', function(req, res, next) {
  if (req.body.message && req.body.eventType) {
    logger.info('The data was received from hook', req.body);

    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
    var notificationData = {};
    notificationData.notification = {
      title: req.body.eventType,
      body: req.body.message.text,
      dir: 'auto',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 400]
    };

    logger.debug(notificationData);

    pushSubscriptions.forEach(function(item) {
      sendNotification(item, JSON.stringify(notificationData));
    });

    res.send({
      text: 'Sent to the subscribers',
      status: '200'
    });
  } else {
    throw new Error('Message data is required');
  }
});

// Default endpoint
app.get('/', function(req, res, next) {
  res.send(
    'Azure PWA API works! Source: <a href="https://github.com/webmaxru/azure-pwa-api">https://github.com/webmaxru/azure-pwa-api</a>'
  );
});

// Starting Express

server.listen(process.env.PORT || 3000, function() {
  logger.info('Listening on port ' + (process.env.PORT || 3000));
});

// Utility function to search the item in the array of objects
function arrayObjectIndexOf(myArray, searchTerm, property) {
  for (var i = 0, len = myArray.length; i < len; i++) {
    if (myArray[i][property] === searchTerm) return i;
  }
  return -1;
}
