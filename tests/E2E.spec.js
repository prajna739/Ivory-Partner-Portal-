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

    // Recently Completed Assessments - values, item parts, sort order
    await dashboard.verifyRecentCompletedAssessments(e2eData.recentCompleted);

    // NEW: click "View all completed assessments →", verify the Assessments page opens, return to the Dashboard
    await dashboard.verifyViewAllCompletedRedirect(e2eData.recentCompleted, e2eData.assessmentsPage);

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


  test('Assessment', async ({ page }) => {
    // Long end-to-end flow (filters, cards, search): the timeout comes from the data file
    test.setTimeout(e2eData.assessmentsPage.testTimeoutMs);

    const nav = new E2EPage(page);
    const ap = e2eData.assessmentsPage;

    // Log in first so the portal is reachable
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.validPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();
    await login.clickSignIn();

    await expect(nav.logoImage).toBeVisible();
    await nav.verifyWelcomeTest();                          // landed on the Dashboard
    await nav.verifyTabIsNotActive(nav.assessmentClick);    // Assessments is not the active tab yet

    // 1. Click the Assessments tab
    await nav.clickAssessmentClick();

    // 2. Verify the page title and that the Assessments tab is highlighted
    await nav.verifyAssessmentsPageTitle(ap.pageTitle, ap.loadTimeoutMs);
    await expect(nav.welcomeTest).toBeHidden();             // the Dashboard content is gone

    await nav.verifyTabIsActive(nav.assessmentClick);
    await nav.verifyTabIsHighlighted(nav.assessmentClick, nav.dashboardClick);
    await nav.verifyTabIsNotActive(nav.dashboardClick);
    await nav.verifyTabIsNotActive(nav.userClick);
    await nav.verifyTabIsNotActive(nav.productClick);
    
    const fp = e2eData.filterPanel;
    await nav.resetFilterPanelToHidden(fp);    
    await nav.clickShowFilters(fp);              
    await nav.verifyFilterPanelDisplayed(fp);    
    await nav.clickHideFilters(fp);              
    await nav.verifyFilterPanelHidden(fp); 
    
        // ---- filters: values, results, date, reset ----
    await nav.clickShowFilters(fp);
    await nav.verifyFilterPanelDisplayed(fp);
    await nav.verifyFilterDropdownValues(fp);

    const totalAll = await nav.verifyAllTypes(ap, fp);
    await nav.verifySpecificType(ap, fp);
    await nav.verifyAllStatuses(ap, fp, totalAll);
    for (const status of fp.statusesToCheck) {
      await nav.verifyStatus(status, ap, fp);
    }
    await nav.verifyDateFilter(ap, fp);
    await nav.clickResetFilters(ap, fp, totalAll);
        // ---- combined filters ----
    const typeStatusTotal = await nav.verifyTypeAndStatusFilter(ap, fp);
    await nav.verifyTypeStatusAndDateFilter(ap, fp, typeStatusTotal);
    await nav.clickResetFilters(ap, fp, totalAll);
        // ---- Assessments page stat cards ----
    await nav.verifyAssessmentCards(ap.cards, ap.loadTimeoutMs);
    const cardValues = await nav.getAssessmentCardValues(ap.cards);
    nav.verifyAssessmentCardsSum(ap.cards, cardValues);
    await nav.verifyAssessmentCardsMatchDashboard(ap, e2eData.dashboardCards, cardValues);
        // ---- search ----
    const sb = e2eData.assessmentSearch;
    const totalBeforeSearch = await nav.getAssessmentsTotal(ap);
    await nav.verifySearchCases(ap, fp, sb);
    await nav.verifySearchClear(ap, fp, sb, totalBeforeSearch);
    await nav.verifySearchOnPage3(ap, fp, sb);

        // ---- type + status + search + date, Clear Filters, Reset Filters ----
    const fl = e2eData.filterSearchFlow;
    const baseTotal = await nav.getAssessmentsTotal(ap);
    await nav.resetFilterPanelToHidden(fp);
    await nav.clickShowFilters(fp);                       
    await nav.verifyFilterPanelDisplayed(fp);
    await nav.verifyTypeStatusSearchAndDate(ap, fp, sb, fl);   
    await nav.clickClearFilters(ap, fp, sb, fl, baseTotal);    
    await nav.clickResetFilters(ap, fp, baseTotal);  
        // ---- assessment table: headers, rows per page, phone format, dates ----
    const tb = e2eData.assessmentTable;
    await nav.verifyTableHeaders(ap, tb);
    await nav.verifyRowsPerPage(ap, tb);
    await nav.verifyPhoneAndDates(tb);  
        // ---- default sort order: Latest first (fresh page, nothing filtered or sorted yet) ----
    await nav.verifyDefaultSortOrder(ap, e2eData.assessmentTable);        
    await nav.verifyDatesSort(ap, tb); 
    await nav.verifyRowActionsOnHover(ap, tb);      
        // ---- Notes: hover three dots -> Notes -> details -> add note -> edit note -> back ----
    const nf = e2eData.assessmentNotes;
    const rowInfo = await nav.hoverAndOpenNotes(ap, tb, nf);
    await nav.verifyNotesAccountDetails(nf, rowInfo);
    const addedNote = await nav.addNote(nf);
    await nav.editNoteAndVerify(nf, addedNote);
    await nav.backToAssessments(ap, nf);   
       // ---- Notify User: enabled -> success pop-up; disabled -> "send next reminder tomorrow" message ----
    const nu = e2eData.notifyUser;
    await nav.verifyNotifyUser(ap, tb, nu);                        
  });
});