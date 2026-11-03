const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middlewares/verifyJWT');
const PaymentController = require('../controllers/payment.controller');

router.post('/', verifyJWT, PaymentController.createPayment);

module.exports = router;
