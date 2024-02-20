const express = require('express');
const router = express.Router();

router.use('/controllers.json', require('./controllers'));


module.exports = router;