import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/pages/Login.Page.js';
import { E2EPage } from '../pages/pages/E2E.Page.js';
import loginData from '../testdata/LoginData.json';
import e2eData from '../testdata/E2EData.json';
const LOGIN_URL = 'https://test-partner.liveivory.com/login';
const DASHBOARD_URL = new URL('/dashboard', LOGIN_URL).href;

// ---------------------------------------------------------------------------------------------
// ONE LOGIN FOR ALL TESTS
// The first test of a worker signs in once; that session (cookies, localStorage, sessionStorage)
// is kept in memory and every other test starts already logged in, on the Dashboard.
// With "workers: 1" the whole run uses a single login.
// ---------------------------------------------------------------------------------------------
const test = base.extend({
  workerAuth: [async ({ browser }, use) => {
    const page = await browser.newPage({ storageState: undefined });   // a clean browser, not logged in
    const login = new LoginPage(page);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await login.fillEmail(loginData.validEmail);
    await login.fillPassword(loginData.validPassword);
    await login.checkTermsCheckbox();
    await login.verifySignInButtonEnabled();
    await login.clickSignIn();
    await new E2EPage(page).verifyWelcomeTest();                       // signed in: the Dashboard is shown
    const state = await page.context().storageState();                 // cookies + localStorage
    const session = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    const origin = new URL(page.url()).origin;
    await page.close();
    await use({ state, session, origin });
  }, { scope: 'worker', timeout: 120_000 }],

  // every test's browser starts with the saved session
  storageState: async ({ workerAuth }, use) => { await use(workerAuth.state); },

  // sessionStorage is not part of storageState, so it is put back before the page loads
  page: async ({ page, workerAuth }, use) => {
    if (Object.keys(workerAuth.session).length) {
      await page.addInitScript(([origin, data]) => {
        if (location.origin !== origin) return;
        for (const [k, v] of Object.entries(data)) {
          if (sessionStorage.getItem(k) === null) sessionStorage.setItem(k, v);
        }
      }, [workerAuth.origin, workerAuth.session]);
    }
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });   // already logged in
    await use(page);
  },
});

test.describe('Ivory-PartnerLogin', () => {

  // The login test uses the plain test (no saved session) so it really signs in
  base('TC_Login_010 - Verify user can sign in with valid email and password', async ({ page }) => {
    const login = new LoginPage(page);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
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

    // click "View all completed assessments ", verify the Assessments page opens, return to the Dashboard
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
    const sk = e2eData.showKey;
    await nav.verifyShowKey(ap, tb, sk); 
    const vh = e2eData.viewHistory;
    await nav.verifyViewHistory(ap, tb, vh);
    const ir = e2eData.ivoryReport;
    await nav.verifyIvoryReport(ap, fp, tb, ir);
    const pg = e2eData.pagination;
    await nav.verifyPagination(ap, fp, tb, pg);
  });
  test('User', async ({ page }) => {
     test.setTimeout(e2eData.assessmentsPage.testTimeoutMs);
    const user = new E2EPage(page);


  //  Click the Users tab
  await user.clickUserClick();

  //  Page title "Users" and the Users tab is highlighted
  await user.verifyUsersPageTitle(e2eData.users.pageTitle, e2eData.users.loadTimeoutMs);
  await user.verifyUsersTabHighlighted();

  //  "Assign Assessment" button is visible and enabled
  await user.verifyAssignAssessmentButton(e2eData.assignAssessmentButtonName);
  // The four stat cards, with their values printed
  await user.verifyUserCards(e2eData.users.cards, e2eData.users.loadTimeoutMs);
  //  Table: column headers, 10 rows per page, "Showing .. of .. users" counts
  await user.verifyUserTable(e2eData.users.table, e2eData.users.loadTimeoutMs);
  await user.verifyUserAssessmentCounts(e2eData.users.table.assessmentCounts, e2eData.users.loadTimeoutMs);

    // Sorting for every column
  await user.verifyUserSorting(e2eData.users.table.sort, e2eData.users.loadTimeoutMs);
    // Hover the three dots of a user: the six action buttons are shown
   await user.verifyUserRowActions(e2eData.users.rowActions, e2eData.users.loadTimeoutMs);

   // Edit User: open and close with Cancel, then open on another user and close with the X icon
   await user.verifyEditUser(e2eData.users.rowActions, e2eData.users.loadTimeoutMs);
  //  Hover a user's three dots -> View Assessments -> Assessments page -> Back to Users
   await user.verifyUserViewAssessments(e2eData.users, e2eData.assessmentsPage, e2eData.users.loadTimeoutMs);
   //  Hover a user's three dots -> View History -> Assessment History page -> Back to the Users page
   await user.verifyUserViewHistory(e2eData.users, e2eData.viewHistory, e2eData.users.loadTimeoutMs);
   // Hover a user's three dots -> View Notes -> Add Note (Cancel, then Save) -> Show more / Show less -> created date -> close icon
   await user.verifyUserViewNotes(e2eData.users, e2eData.assessmentNotes, e2eData.users.loadTimeoutMs);
   await user.verifyUserShowKey(e2eData.users, e2eData.showKey, e2eData.users.loadTimeoutMs);
   // Pagination: Next -> page 2, Previous -> page 1, click a page number
   await user.verifyUserPagination(e2eData.users, e2eData.users.loadTimeoutMs);  
});
  test('Product', async ({ page }) => {
    test.setTimeout(e2eData.products.testTimeoutMs);

    const product = new E2EPage(page);


    // Click the Products tab
    await product.clickProductClick();
    await product.verifyTabIsActive(product.productClick);

    // Page title and the "<n> assessments available · <n> active" statement
    await product.verifyProductsPage(e2eData.products, e2eData.products.loadTimeoutMs);
    // Tab counts, all card names, View details on an active card -> pop-up with its details and "Active for your account"
    await product.verifyProductsCardsAndDetails(e2eData.products, e2eData.products.loadTimeoutMs);
    //Active / Available / All tabs: assessment names, and "Contact Sales" on inactive ones (only if any exist)
    await product.verifyProductsTabFilters(e2eData.products, e2eData.products.loadTimeoutMs);
    // Search: invalid data -> "No results", Reset filters, valid data -> results, cross icon clears the search
    await product.verifyProductsSearch(e2eData.products, e2eData.products.loadTimeoutMs);
  });
   test('Profile', async ({ page }) => {
    test.setTimeout(e2eData.profile.testTimeoutMs);

    const profile = new E2EPage(page);


    // Click the Profile menu
    await profile.clickProfileMenu(e2eData.profile, e2eData.profile.loadTimeoutMs);

    //Page title and the "View and manage your profile and workspace settings" statement
    await profile.verifyProfileScreen(e2eData.profile, e2eData.profile.loadTimeoutMs);
    //The four tabs: displayed, "Information" selected by default, each tab loads its own content
    await profile.verifyProfileTabs(e2eData.profile, e2eData.profile.loadTimeoutMs);
    await profile.verifyProfileInformation(e2eData.profile, loginData.validEmail, e2eData.profile.loadTimeoutMs);
    await profile.verifyProfilePreferences(e2eData.profile, e2eData.profile.loadTimeoutMs);
    await profile.verifyProfileAssessments(e2eData.profile, e2eData.profile.loadTimeoutMs);
    await profile.verifyProfileNotifications(e2eData.profile, e2eData.profile.loadTimeoutMs);

    });
});