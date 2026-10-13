import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/pages/Login.Page.js';
import loginData from '../testdata/LoginData.json';
const LOGIN_URL = 'https://test-partner.liveivory.com/login';

test.describe('Ivory-PartnerLogin', () => {
  let login;

  test.beforeEach(async ({ page }) => {
    login = new LoginPage(page);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  });

  test('TC_Login_001 - Verify logo, login text, tabs and fields are visible', async () => {
    await expect(login.logoImage).toBeVisible();
    await expect(login.loginText).toBeVisible();
    await expect(login.passwordTab).toBeVisible();
    await expect(login.otpTab).toBeVisible();
    await expect(login.emailText).toBeVisible();
    await expect(login.passwordText).toBeVisible();
  });

  test('TC_Login_002 - Verify Password and OTP toggle options are visible and enabled', async () => {
    await expect(login.passwordTab).toBeVisible();
    await expect(login.passwordTab).toBeEnabled();
    await expect(login.otpTab).toBeVisible();
    await expect(login.otpTab).toBeEnabled();
  });

  test('TC_Login_003 - Verify OTP tab can be selected and OTP form is shown', async () => {
    await login.clickOtpTab();

    // OTP form is displayed
    await expect(login.otpEmailText).toBeVisible();
    await expect(login.otpHelperText).toBeVisible();
    await expect(login.sendOtpButton).toBeVisible();
    await expect(login.sendOtpButton).toBeDisabled(); // email is empty

    // Password-mode elements should be gone
    await expect(login.passwordText).toBeHidden();
    await expect(login.forgotPasswordLink).toBeHidden();
    await expect(login.signInButton).toBeHidden();
  });

  test('TC_Login_004 - Verify toggling back to Password tab restores password form', async () => {
    await login.clickOtpTab();
    await expect(login.sendOtpButton).toBeVisible();

    await login.clickPasswordTab();

    await expect(login.emailText).toBeVisible();
    await expect(login.passwordText).toBeVisible();
    await expect(login.forgotPasswordLink).toBeVisible();
    await expect(login.signInButton).toBeVisible();

    await expect(login.otpHelperText).toBeHidden();
    await expect(login.sendOtpButton).toBeHidden();
  });

  test('TC_Login_005 - Verify Contact support link is visible and clickable', async () => {
    await expect(login.contactSupportLink).toBeVisible();

    await login.clickContactSupportLink(); 
  });
  test('TC_Login_006 - Verify Sign in button is disabled when both fields are empty', async () => {
    await login.verifyFieldsAreEmpty();
    await login.verifySignInButtonDisabled();
  });
    test('TC_Login_007 - Verify Sign in button is disabled when only email is entered', async () => {
    await login.fillEmail(loginData.validEmail);

    await expect(login.emailText).toHaveValue(loginData.validEmail);
    await login.verifyPasswordIsEmpty();
    await login.verifySignInButtonDisabled();
    });

  test('TC_Login_008 - Verify Sign in button is enabled with valid email, password and terms checked', async () => {
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.validPassword);
    await login.checkTermsCheckbox();

    await expect(login.emailText).toHaveValue(loginData.validEmail);
    await expect(login.passwordText).toHaveValue(loginData.validPassword);
    await login.verifyTermsCheckboxChecked();
    await login.verifySignInButtonEnabled();
  });
    test('TC_Login_009 - Verify Sign in button is disabled when both fields are filled but terms are unchecked', async () => {
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.validPassword);
    await login.uncheckTermsCheckbox();

    await expect(login.emailText).toHaveValue(loginData.validEmail);
    await expect(login.passwordText).toHaveValue(loginData.validPassword);
    await login.verifyTermsCheckboxUnchecked();
    await login.verifySignInButtonDisabled();
  });
    test('TC_Login_010 - Verify user can sign in with valid email and password', async () => {
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.validPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();

    await login.clickSignIn();


  });
  
 test('TC_Login_011 - Verify error is shown for valid email and wrong password', async () => {
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.invalidPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();

    await login.clickSignIn();

    await login.verifyErrorMessage(loginData.invalidPasswordMessage);
  });

  test('TC_Login_012 - Verify "User not found" error is shown for unregistered email', async () => {
    await login.fillEmail(loginData.unregisteredEmail);
    await login.fillPassword(loginData.unregisteredPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();

    await login.clickSignIn();

    await login.verifyErrorMessage(loginData.userNotFoundMessage); 
  });
  test('TC_Login_013 - Verify error is shown for email with invalid pattern', async () => {
    await login.fillEmail(loginData.invalidEmailPattern);
    await login.fillPassword(loginData.invalidEmailPatternPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();

    await login.clickSignIn();

    await login.verifyErrorMessage(loginData.invalidEmailPatternMessage);
  });
  for (const phone of loginData.invalidPhones) {
    test(`${phone.id} - Verify error is shown for invalid phone (${phone.case})`, async () => {
      await login.fillEmail(phone.value);
      await login.fillPassword(phone.password);
      await login.checkTermsCheckbox();
      await login.verifySignInButtonEnabled();

      await login.clickSignIn();

      await login.verifyErrorMessage(phone.message);
    });
  }

});