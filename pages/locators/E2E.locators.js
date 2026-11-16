
export const ACTIVE_TAB_PATTERN = /active|selected|current|highlight/i;

export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const E2ELocators = {
    logoImage: (page) => page.getByRole('img', { name: 'Test Partner' }),
    loginText: (page) => page.getByText('Test Partner', { exact: true }),
    dashboardClick:(page)=> page.locator('span').filter({ hasText: 'Dashboard' }).first(),
    assessmentClick:(page)=> page.locator('span').filter({ hasText: 'Assessments' }).first(),
    userClick:(page)=> page.locator('span').filter({ hasText: 'Users' }).first(),
    productClick:(page)=>page.locator('span').filter({ hasText: 'Products' }).first(),

    tabItem: (tabLabel) =>
        tabLabel.locator(
            'xpath=ancestor-or-self::*[self::a or self::li or self::button or @role="menuitem" or @role="tab"][1]'
        ),
    welcomeTest:(page)=> page.getByRole('heading', { name: 'Welcome to your Partner Dashboard' }),
    welcomSubtitle:(page)=> page.getByText('Track, manage, and analyze all your assessments in one place.', { exact: true }),

    partnerAssessmentLabel: (page, labelText) => page.getByText(labelText, { exact: true }),
    partnerAssessmentLink: (page, url) => page.getByRole('link', { name: url, exact: true }),

    assignAssessmentButton: (page, buttonName) => page.getByRole('button', { name: buttonName, exact: true }),

    dashboardCardLabel: (page, label) =>
        page.getByRole('term').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`) }),
    dashboardCardValue: (page, label) =>
        E2ELocators.dashboardCardLabel(page, label).locator('xpath=..').getByRole('definition'),

    
    chartCard: (page, title, legendText) =>
        page.locator('div')
            .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
            .filter({ has: page.getByText(legendText, { exact: true }) })
            .last(),
    chartTitle: (card, title) => card.getByRole('heading', { name: title, exact: true }),
    chartSvg: (card) => card.getByRole('img').first(),
    chartLegendText: (card, name) => card.getByText(name, { exact: true }).first(),
    chartAxisLabels: (card, pattern) => card.getByText(new RegExp(`^\\s*(?:${pattern})\\s*$`)),
    chartTooltip: (page, card) =>
        card.locator('[role="tooltip"], [class*="tooltip" i]').or(page.getByRole('tooltip')),

    trendPeriodSelect: (page, optionLabel) =>
        page.getByRole('combobox').filter({ has: page.locator('option', { hasText: optionLabel }) }),
    trendChartLoading: (page, loadingText) => page.getByText(loadingText, { exact: true }),

    recentCompletedCard: (page, title, viewAllText) =>
        page.locator('div')
            .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
            .filter({ has: page.getByRole('button', { name: viewAllText }) })
            .last(),
    recentCompletedTitle: (card, title) => card.getByRole('heading', { name: title, exact: true }),

    recentCompletedViewAll: (card, viewAllText) => card.getByRole('button', { name: viewAllText }),

    // Assessments page
    assessmentsHeading: (page, headingText) => page.getByText(headingText, { exact: true }).first(),
    assessmentsLoading: (page, loadingText) => page.getByText(loadingText, { exact: true }),
    assessmentsCount: (page, countPattern) => page.getByText(new RegExp(countPattern)).first(),
  //---------------------------
  //Assessment locaters
  //----------------------------
  
    assessmentsPageTitle: (page, title) => page.getByRole('heading', { name: title, exact: true }),
    filterToggle: (page, buttonName) => page.getByRole('button', { name: buttonName, exact: true }),
    filterPanelTitle: (page, title) => page.getByText(title, { exact: true }),
    filterPanel: (page, title, resetText) =>
        page.locator('div')
            .filter({ has: page.getByText(title, { exact: true }) })
            .filter({ has: page.getByRole('button', { name: resetText, exact: true }) })
            .last(),
    filterPanelControl: (panel, label) => panel.getByText(label, { exact: true }).first(),
    filterPanelReset: (panel, resetText) => panel.getByRole('button', { name: resetText, exact: true }),

filterSelect: (panel, label) => panel.getByRole('combobox', { name: label, exact: true }),
filterDateInput: (panel, label) => panel.getByRole('textbox', { name: label, exact: true }),
assessmentRows: (page) => page.locator('tbody tr'),
noResultsMessage: (page, text) => page.getByText(text, { exact: true }),
bottomCount: (page, pattern) => page.getByText(new RegExp(pattern)),
searchBox: (page, name) => page.getByRole('textbox', { name, exact: true }),
searchClear: (page, text) => page.getByRole('button', { name: text, exact: true }),   // exact: does not match "Clear Filters"
paginationButton: (page, navName, number) =>
page.getByRole('navigation', { name: navName }).getByRole('button', { name: String(number), exact: true }),
clearAllFilters: (page, text) => page.getByRole('button', { name: text, exact: true }),

notesPageText: (page, text) => page.getByText(text, { exact: true }),
noteDetailRow: (page, label) => page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last(),
noteTextBox: (page, placeholder) => page.getByPlaceholder(placeholder),
noteCard: (page, text) => page.locator('p').filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).locator('xpath=..'),
    //---------------------------------------------------
    //user locater
    //--------------------------------------------------------------
    
    usersPageTitle: (page, title) => page.getByRole('heading', { name: title, exact: true }),
    usersCardLabel: (page, label) => page.getByText(label, { exact: true }).first(),
    usersCard: (page, label, valuePattern) =>
        page.locator('div')
            .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*(?:${valuePattern})\\s*$`) })
            .last(),
        usersHeaders: (page) => page.getByRole('columnheader'),
    usersRows: (page) => page.locator('tbody tr'),
    usersRowCell: (row, index) => row.locator('td').nth(index),
    usersCount: (page, pattern) => page.getByText(new RegExp(pattern)).first(),
    userRowAction: (row, name) => row.getByRole('button', { name }).first(),
    editUserDialog: (page, title, cancelName) =>
        page.locator('div')
            .filter({ has: page.getByText(title, { exact: true }) })
            .filter({ has: page.getByRole('button', { name: cancelName, exact: true }) })
            .last(),
    editUserCancel: (dialog, name) => dialog.getByRole('button', { name, exact: true }),
    editUserClose: (dialog, name) => dialog.getByRole('button', { name }).or(dialog.locator('button').first()).first(),

    backToUsers: (page, text) =>
        page.getByRole('link', { name: text }).or(page.getByRole('button', { name: text })).first(),

    userNotesClose: (page, title) =>
        page.getByText(title, { exact: true }).first().locator('xpath=ancestor::*[.//button][1]').getByRole('button').first(),
    userNoteCard: (page, text, createdLabel) =>
        page.locator('div')
            .filter({ has: page.getByText(text, { exact: true }) })
            .filter({ has: page.getByText(createdLabel) })
            .last(),
userKeyDialog: (page, title, closeName) => page.locator('div').filter({ has: page.getByText(title, { exact: true }) }).filter({ has: page.getByRole('button', { name: closeName, exact: true }) }).last(),
userKeyCancelIcon: (dialog, name) => dialog.getByRole('button', { name }).or(dialog.locator('button').first()).first(),
  usersPagination: (page, name) => page.getByRole('navigation', { name }),
  usersPageButton: (nav, name, exact) => nav.getByRole('button', { name, exact }),
//==============================
//product page locaters
//===============================
  productsPageTitle: (page, name) => page.getByRole('heading', { name, exact: true }),
  productsCount: (page, pattern) => page.getByText(new RegExp(pattern)).first(),
  productTab: (page, label, countPattern) => page.locator('button').filter({ hasText: new RegExp(`^\\s*${label}${countPattern}\\s*$`) }).first(),
  productCards: (page, action) => page.getByRole('button', { name: new RegExp(`^${action} for `) }),
  productCardName: (card) => card.getByRole('heading').first(),
  productCardBadge: (card, text) => card.getByText(text, { exact: true }),
  productDialog: (page, name, labels) => labels.reduce((loc, l) => loc.filter({ has: page.getByText(new RegExp(`^\\s*${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')) }), page.locator('div').filter({ has: page.getByText(name, { exact: true }) })).last(),
  productDialogLabel: (dialog, text) => dialog.getByText(new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')).first(),
  productContactSales: (card, name) => card.getByRole('button', { name, exact: true }),
  productDialogClose: (dialog, name) => dialog.getByRole('button', { name }).or(dialog.locator('button').first()).first(),
    productSearchBox: (page, name) => page.getByRole('textbox', { name }),
  // the cross icon = the last button next to the search box (it comes after the tabs in the page)
  productSearchClear: (box, name) => box.locator('xpath=ancestor::*[.//button][1]').getByRole('button', { name }).or(box.locator('xpath=ancestor::*[.//button][1]').getByRole('button').last()).last(),
  productNoResults: (page, text, term) => page.getByText(new RegExp(`${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\W?${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)).first(),
  productResetFilters: (page, name) => page.getByRole('button', { name }).or(page.getByRole('link', { name })).first(),
//==========================================
//profile locater
//==========================================
    
    profileMenu: (page, name) => page.getByRole('link', { name, exact: true }),
    profilePageTitle: (page, name) => page.getByRole('heading', { name, exact: true }),
    profileSubtitle: (page, text) => page.getByText(text, { exact: true }),
        profileTab: (page, name) => page.getByRole('tab', { name }).or(page.getByRole('button', { name })).first(),
    profileText: (page, text) => page.getByText(text, { exact: true }).first(),
  profileField: (page, label) => page.getByText(label, { exact: true }).first().locator('xpath=..'),
  profileButton: (page, name) => page.getByRole('button', { name, exact: true }).or(page.getByText(name, { exact: true })).first(),
  profileInput: (page, label) => page.getByText(label, { exact: true }).first().locator('xpath=following::input[1]'),
  
  profileText: (page, text) => page.getByText(text, { exact: true }).first(),
  profileTextRe: (page, re) => page.getByText(re).first(),
  // hidden <input role="switch"> (used to read ON/OFF)
  profileToggle: (page, title) => page.getByText(title, { exact: true }).first()
    .locator("xpath=ancestor::*[.//*[@role='switch' or @type='checkbox'] or .//button][1]")
    .locator("[role='switch'], input[type='checkbox'], button").first(),
  // visible switch track (used to check visibility and to click)
  profileToggleTrack: (page, title) => {
    const input = E2ELocators.profileToggle(page, title);
    return input.locator('xpath=following-sibling::label[1]')
      .or(input.locator("xpath=ancestor::*[contains(@class,'Switch-root')][1]//label")).first();
  },
  profileToast: (page, message) => page.getByText(message, { exact: true }).first(),

    profileIcon: (page, title) => {
    const t = page.getByText(title, { exact: true }).first();
    return t.locator('svg').or(t.locator('xpath=..').locator('svg')).first();
  },
  profilePlaceholder: (page, placeholder) => page.getByPlaceholder(placeholder).first(),
  profileRowDelete: (page, text) => page.getByText(text, { exact: true }).first()
    .locator('xpath=ancestor::*[.//button][1]').locator('button').first(),
}