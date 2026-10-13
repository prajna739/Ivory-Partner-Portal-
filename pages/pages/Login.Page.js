import { expect } from '@playwright/test';
import { LoginLocators } from '../locators/Login.locators.js';

export class LoginPage {
  constructor(page) {
    this.page = page;
    this.logoImage = LoginLocators.logoImage(page);
    this.loginText = LoginLocators.loginText(page);
    this.otpTab = LoginLocators.otpTab(page);
    this.passwordTab = LoginLocators.passwordTab(page);
    this.emailText = LoginLocators.emailText(page);
    this.passwordText = LoginLocators.passwordText(page);
    this.forgotPasswordLink = LoginLocators.forgotPasswordLink(page);
    this.signInButton = LoginLocators.signInButton(page);
    this.termsCheckbox = LoginLocators.termsCheckbox(page);
    this.otpEmailText = LoginLocators.otpEmailText(page);
    this.otpHelperText = LoginLocators.otpHelperText(page);
    this.sendOtpButton = LoginLocators.sendOtpButton(page);
    this.contactSupportLink = LoginLocators.contactSupportLink(page);
  }

  async verifyLogoImage() { return this.logoImage.isVisible(); }
  async verifyLoginText() { return this.loginText.isVisible(); }
  async verifyOtpTab() { return this.otpTab.isVisible(); }
  async verifyPasswordTab() { return this.passwordTab.isVisible(); }
  async verifyEmailText() { return this.emailText.isVisible(); }
  async verifyPasswordText() { return this.passwordText.isVisible(); }

  async clickOtpTab() { await this.otpTab.click(); }
  async clickPasswordTab() { await this.passwordTab.click(); }
  async clickContactSupportLink() { await this.contactSupportLink.click(); }

  async verifyFieldsAreEmpty() {
    await expect(this.emailText).toHaveValue('');
    await expect(this.passwordText).toHaveValue('');
  }
  async verifySignInButtonDisabled() {
    await expect(this.signInButton).toBeVisible();
    await expect(this.signInButton).toBeDisabled();
  }

  async fillEmail(email) {
    await this.emailText.fill(email);
  }

  async verifyPasswordIsEmpty() {
    await expect(this.passwordText).toHaveValue('');
  }

  async fillPassword(password) {
    await this.passwordText.fill(password);
  }

  async checkTermsCheckbox() {
    await this.termsCheckbox.check();
  }

  async verifyTermsCheckboxChecked() {
    await expect(this.termsCheckbox).toBeChecked();
  }

  async verifySignInButtonEnabled() {
    await expect(this.signInButton).toBeVisible();
    await expect(this.signInButton).toBeEnabled();
  }

  async uncheckTermsCheckbox() {
    await this.termsCheckbox.uncheck();
  }

  async verifyTermsCheckboxUnchecked() {
    await expect(this.termsCheckbox).not.toBeChecked();
  }

  async clickSignIn() {
    await this.signInButton.click();
  }

  async verifyLoginSuccessful() {
    await expect(this.page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  }


  async verifyErrorMessage(text) {
    await expect(LoginLocators.errorMessage(this.page, text)).toBeVisible({ timeout: 15_000 });
  }

  async verifyStillOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.signInButton).toBeVisible();
  }
}