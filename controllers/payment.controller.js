const Payment = require('../models/Payment');
const paypal = require('../utils/paypalClient');
const { sendEmail, paymentSuccessTemplate } = require('../utils/emailService');

exports.createPayment = async (req, res) => {
  const email = req.user.email;
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ code: 'MISSING_ORDER_ID', message: 'orderId is required' });
  }

  try {
    const existing = await Payment.findOne({ useremail: email, status: 'ACTIVE' });
    if (existing) {
      return res.status(409).json({ code: 'ALREADY_PAID', message: 'You already have an active lifetime payment.' });
    }

    const orderUsed = await Payment.findOne({ paypalOrderId: orderId });
    if (orderUsed) {
      return res.status(409).json({ code: 'ORDER_ALREADY_PROCESSED', message: 'This payment has already been processed.' });
    }

    let paypalOrder;
    try {
      paypalOrder = await paypal.captureOrder(orderId);
    } catch (paypalErr) {
      const paypalMsg = paypalErr.response?.data?.details?.[0]?.description
        || paypalErr.response?.data?.message
        || paypalErr.message;
      console.error('PayPal capture error:', paypalMsg);

      if (paypalErr.response?.status === 422) {
        return res.status(422).json({ code: 'PAYPAL_CAPTURE_FAILED', message: 'Payment could not be captured.' });
      }
      if (paypalErr.response?.status === 401) {
        return res.status(500).json({ code: 'PAYPAL_AUTH_FAILED', message: 'Payment gateway authentication failed.' });
      }
      return res.status(502).json({ code: 'PAYPAL_GATEWAY_ERROR', message: 'Could not connect to payment gateway.' });
    }

    if (paypalOrder.status !== 'COMPLETED') {
      return res.status(400).json({ code: 'PAYMENT_NOT_COMPLETED', message: `Payment not completed. Status: ${paypalOrder.status}` });
    }

    const capturedAmount = parseFloat(
      paypalOrder.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value
    );

    if (!capturedAmount) {
      return res.status(400).json({ code: 'CANNOT_VERIFY_AMOUNT', message: 'Could not verify payment amount.' });
    }

    if (capturedAmount !== 100) {
      return res.status(400).json({ code: 'INVALID_PAYMENT_AMOUNT', message: `Invalid payment amount: $${capturedAmount}` });
    }

    await Payment.create({
      useremail: email,
      status: 'ACTIVE',
      paypalOrderId: orderId,
      paypalPayerId: paypalOrder.payer?.payer_id,
      amount: capturedAmount,
    });

    // Send confirmation email
    try {
      const emailContent = paymentSuccessTemplate(email.split('@')[0]);
      await sendEmail(email, 'Payment Successful - Lifetime Access Activated', emailContent);
    } catch (emailErr) {
      console.error('Failed to send payment success email:', emailErr);
    }

    return res.status(201).json({ message: 'Payment saved' });

  } catch (err) {
    console.error('Unexpected error in createPayment:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'An unexpected server error occurred.' });
  }
};
