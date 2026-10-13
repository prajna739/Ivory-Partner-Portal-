export const LoginLocators = {
  logoImage: (page) => page.getByRole('img', { name: 'Ivory Logo' }),
  loginText: (page) => page.getByRole('heading', { name: "Partner's Workspace" }),

  // Toggle (exact match avoids clashing with "Send OTP")
  otpTab: (page) => page.getByRole('button', { name: 'OTP', exact: true }),
  passwordTab: (page) => page.getByRole('button', { name: 'Password', exact: true }),

  // Password mode
  emailText: (page) => page.getByLabel('Email Address or Phone Number'),
  passwordText: (page) => page.getByLabel('Password', { exact: true }),
  forgotPasswordLink: (page) => page.getByText('Forgot your password?'),
  signInButton: (page) => page.getByRole('button', { name: 'Sign in' }),
  termsCheckbox: (page) => page.getByRole('checkbox', { name: 'I agree to Terms & Conditions and Privacy Policy' }),
  
//Error message
  errorMessage: (page, text) => page.getByText(text, { exact: true }),

  // OTP mode
  otpEmailText: (page) => page.getByLabel('Email Address', { exact: true }),
  otpHelperText: (page) => page.getByText("We'll send a one-time password to your email."),
  sendOtpButton: (page) => page.getByRole('button', { name: 'Send OTP' }), // <-- fixed

  // Common
  contactSupportLink: (page) => page.getByRole('link', { name: 'Contact support' }),
 //link
 termsConditionLink:(page)=>page.getByRole('link', { name: 'Terms & Conditions' }),
 privacyLink:(page)=> page.getByRole('link', { name: 'Privacy Policy' })

};