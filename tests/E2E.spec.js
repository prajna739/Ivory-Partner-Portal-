import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/pages/Login.Page.js';
import { E2EPage } from '../pages/pages/E2E.Page.js';
import loginData from '../testdata/LoginData.json';
import e2eData from '../testdata/E2EData.json';
const LOGIN_URL = 'https://test-partner.liveivory.com/login';

test.describe('Ivory-PartnerLogin', () => {
  let login;

  test.beforeEach(async ({ page }) => {
    login = new LoginPage(page);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  });

  test('TC_Login_010 - Verify user can sign in with valid email and password', async () => {
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.validPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();

    await login.clickSignIn();
  });

  test('Dashboard', async ({ page }) => {        // <-- inject the page fixture
    // Long end-to-end flow (tooltip sweep + chart switches + legend toggles): triples the default test timeout
    test.slow();

    const dashboard = new E2EPage(page);

    // Log in first so the dashboard is actually reachable
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.validPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();
    await login.clickSignIn();

    await expect(dashboard.logoImage).toBeVisible();
    await expect(dashboard.loginText).toBeVisible();

    // Verify the active tab is highlighted on the Dashboard (landing tab)
    await dashboard.verifyDashboardTabHighlighted();
    await dashboard.verifyTabIsNotActive(dashboard.assessmentClick);
    await dashboard.verifyTabIsNotActive(dashboard.userClick);
    await dashboard.verifyTabIsNotActive(dashboard.productClick);

    // Dashboard tab: verify active state and the welcome text while ON the Dashboard page
    await dashboard.clickDashboardClick();
    await dashboard.verifyTabIsActive(dashboard.dashboardClick);
    await dashboard.verifyWelcomeTest();
    await dashboard.verifyWelcomSubtitle();

    // Verify the partner assessment URL, click it, and close the new tab
    await dashboard.verifyPartnerAssessmentUrl(e2eData.assessmentUrlLabel, e2eData.partnerAssessmentUrl);
    await dashboard.clickPartnerAssessmentUrlAndClose(e2eData.partnerAssessmentUrl);

    // Verify the Assign Assessment button is visible and enabled
    await dashboard.verifyAssignAssessmentButton(e2eData.assignAssessmentButtonName);

    // Stat cards - labels, printed values, sum check, completion rate check
    const cards = e2eData.dashboardCards;
    await dashboard.verifyDashboardCards(cards);
    const cardValues = await dashboard.getDashboardCardValues(cards);
    dashboard.verifyCardsSum(cards, cardValues);
    dashboard.verifyCompletionRate(cards, cardValues);

    // Trend chart - title, axes, legend (blue/orange), and tooltip on hover
    const chart = e2eData.trendChart;
    await dashboard.verifyTrendChartRendered(chart);
    await dashboard.verifyTrendChartAxes(chart);
    await dashboard.verifyTrendChartLegend(chart);
    await dashboard.verifyTrendChartTooltip(chart);

    // Period dropdown - options present, then each option shows its graph
    await dashboard.verifyTrendPeriodOptions(chart);
    await dashboard.verifyTrendPeriodCharts(chart);

    // Legend toggle - click Assigned / Completed to disable, click again to enable
    await dashboard.verifyTrendLegendToggle(chart);

    // NEW: Recently Completed Assessments - values, item parts, sort order
    await dashboard.verifyRecentCompletedAssessments(e2eData.recentCompleted);

    // Navigate through the remaining tabs, checking the active highlight on each
    await dashboard.clickAssessmentClick();
    await dashboard.verifyTabIsActive(dashboard.assessmentClick);
    await dashboard.verifyTabIsNotActive(dashboard.dashboardClick);
    await dashboard.verifyTabIsHighlighted(dashboard.assessmentClick, dashboard.dashboardClick);

    await dashboard.clickUserClick();
    await dashboard.verifyTabIsActive(dashboard.userClick);
    await dashboard.verifyTabIsNotActive(dashboard.assessmentClick);

    await dashboard.clickProductClick();
    await dashboard.verifyTabIsActive(dashboard.productClick);
    await dashboard.verifyTabIsNotActive(dashboard.userClick);
  });
});