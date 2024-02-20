const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
    let obj = {};
    try {
        obj.controllers = [...global.Controllers];

        res.json(obj);
    } catch (err) {
        console.error(err)
    }
});


module.exports = router;