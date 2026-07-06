const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true, // Enable connection pooling
  maxConnections: 2, // Limit concurrent connections
  maxMessages: 50, // Limit messages per connection
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlContent,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

exports.welcomeTemplate = (username) => `
<div style="direction: ltr; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e5e5; font-size: 14px;">

  <div style="text-align: center; padding: 12px 0; background: #fafafa; border-bottom: 1px solid #ededed;">
    <img src="https://res.cloudinary.com/dynprvsfg/image/upload/v1765243945/DGTplogo_1_fpek3w.png" alt="DGT Portfolio" style="max-width: 100px; height: auto;" />
  </div>

  <div style="padding: 24px 20px; text-align: center;">

    <h1 style="color: #0f0f0f; font-size: 22px; font-weight: 700; margin: 0 0 10px;">
      Welcome to DGT Portfolio 🚀
    </h1>

    <div style="width: 50px; height: 3px; background-color: #000; margin: 0 auto 18px; border-radius: 2px;"></div>

    <p style="color: #555; line-height: 1.7; margin: 0 0 18px;">
      Hi <strong>${username}</strong>,<br/><br/>
      Your account is ready! Your <strong>30-day free trial</strong> has started.
      Build a professional portfolio in just <strong>5 minutes</strong>—no coding required.
    </p>

    <p style="color: #555; line-height: 1.6; margin-bottom: 18px;">
      Start creating your portfolio today and make a strong first impression.
    </p>
    
   
    <a href="https://mylio.site/update-profile"
      style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 34px; border-radius: 8px; font-weight: 600; font-size: 15px;">
      Create My Portfolio
    </a>

    <p style="margin-top: 22px; font-size: 13px; color: #777;">
      Your portfolio can help recruiters quickly understand your profile and increase your chances of landing your next job or freelance opportunity.
    </p>

  </div>

  <div style="background-color: #fafafa; padding: 10px; text-align: center; color: #8c8c8c; border-top: 1px solid #ededed; font-size: 11px;">
    &copy; ${new Date().getFullYear()} DGT Portfolio. All rights reserved.
  </div>

</div>
`;

exports.trialExpiredTemplate = (username) => `
<div style="direction: ltr; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e5e5; font-size: 14px;">

  <div style="text-align: center; padding: 10px 0; background: #fafafa; border-bottom: 1px solid #ededed;">
    <img src="https://res.cloudinary.com/dynprvsfg/image/upload/v1765243945/DGTplogo_1_fpek3w.png" alt="DGT Portfolio" style="max-width: 100px; height: auto;" />
  </div>

  <div style="padding: 15px 20px; text-align: center;">

    <h1 style="color: #0f0f0f; font-size: 20px; font-weight: 700; margin: 0 0 8px;">
      Time's Up! ⌛
    </h1>
    
    <div style="width: 40px; height: 2px; background-color: #000; margin: 0 auto 12px; border-radius: 2px;"></div>

    <p style="color: #555; line-height: 1.5; margin: 0 0 12px;">
      Hi <strong>${username}</strong>,<br/>
      Your 7-day trial has ended. Your portfolio is currently <strong>locked</strong>, but don't worry—all your progress is safely saved and ready to go live!
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 0 auto 15px; max-width: 350px;">
        <p style="color: #475569; font-size: 13px; margin: 0;">
          Unlock your full professional portfolio and keep your custom link active.
        </p>
    </div>

    <div style="margin-bottom: 15px; direction: ltr;">
      <span style="font-size: 13px; font-weight: 600; color: #333;">Unlock Link: </span>
      <a href="https://mylio.site/payment" style="font-size: 13px; color: #2563eb; text-decoration: underline;">https://mylio.site/payment</a>
    </div>

    <a href="https://mylio.site/payment" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 10px 30px; border-radius: 6px; font-weight: 600; font-size: 14px;">
      Keep My Portfolio Online
    </a>

    <p style="color: #7d7d7d; font-size: 12px; margin-top: 15px; margin-bottom: 0;">
      Don't let your professional image expire. One click keeps you live and reachable.
    </p>

  </div>

  <div style="background-color: #fafafa; padding: 8px; text-align: center; color: #8c8c8c; border-top: 1px solid #ededed; font-size: 11px;">
    &copy; ${new Date().getFullYear()} DGT Portfolio. All rights reserved.
  </div>

</div>
`;

exports.paymentSuccessTemplate = (email) => `
<div style="direction: ltr; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e5e5; font-size: 14px;">

  <div style="text-align: center; padding: 10px 0; background: #fafafa; border-bottom: 1px solid #ededed;">
    <img src="https://res.cloudinary.com/dynprvsfg/image/upload/v1765243945/DGTplogo_1_fpek3w.png" alt="DGT Portfolio" style="max-width: 100px; height: auto;" />
  </div>

  <div style="padding: 15px 20px; text-align: center;">
    <h1 style="color: #0f0f0f; font-size: 20px; font-weight: 700; margin: 0 0 8px;">
      Payment Successful 🎉
    </h1>
    
    <div style="width: 40px; height: 2px; background-color: #000; margin: 0 auto 12px; border-radius: 2px;"></div>

    <p style="color: #555; line-height: 1.5; margin: 0 0 12px;">
      Hi <strong>${email}</strong>,<br/>
      Your payment has been successfully processed.<br/>
      Your Lifetime Portfolio access is now active and ready to use.
    </p>

    <a href="https://mylio.site" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 10px 30px; border-radius: 6px; font-weight: 600; font-size: 14px;">
      Go to Dashboard
    </a>
  </div>

  <div style="background-color: #fafafa; padding: 8px; text-align: center; color: #8c8c8c; border-top: 1px solid #ededed; font-size: 11px;">
    &copy; ${new Date().getFullYear()} DGT Portfolio. All rights reserved.
  </div>

</div>
`;
