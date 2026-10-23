// Pattern used to detect the "active" state. Change it in one place if your app uses a different class name.
export const ACTIVE_TAB_PATTERN = /active|selected|current|highlight/i;

// Escapes text so a label can safely be used inside a RegExp
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

    // Trend chart. The card is the innermost container holding both the title and the legend.
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

    // Period dropdown (found by one of its options) and the loading message
    trendPeriodSelect: (page, optionLabel) =>
        page.getByRole('combobox').filter({ has: page.locator('option', { hasText: optionLabel }) }),
    trendChartLoading: (page, loadingText) => page.getByText(loadingText, { exact: true }),

    // Recently Completed Assessments card = innermost container holding its heading AND its "view all" button
    recentCompletedCard: (page, title, viewAllText) =>
        page.locator('div')
            .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
            .filter({ has: page.getByRole('button', { name: viewAllText }) })
            .last(),
    recentCompletedTitle: (card, title) => card.getByRole('heading', { name: title, exact: true }),

    //"View all completed assessments →" button inside the card (name matches as a substring, so the arrow is covered)
    recentCompletedViewAll: (card, viewAllText) => card.getByRole('button', { name: viewAllText }),

    // Assessments page
    assessmentsHeading: (page, headingText) => page.getByText(headingText, { exact: true }).first(),
    assessmentsLoading: (page, loadingText) => page.getByText(loadingText, { exact: true }),
    assessmentsCount: (page, countPattern) => page.getByText(new RegExp(countPattern)).first(),
  //---------------------------
  //Assessment locaters
  //----------------------------
  
    assessmentsPageTitle: (page, title) => page.getByRole('heading', { name: title, exact: true }),
        // Assessments page - Show / Hide Filters
    // One button whose name swaps between "Show Filters" and "Hide Filters"
    filterToggle: (page, buttonName) => page.getByRole('button', { name: buttonName, exact: true }),
    filterPanelTitle: (page, title) => page.getByText(title, { exact: true }),
    // Panel = innermost container holding the panel title AND its "Reset Filters" button
    filterPanel: (page, title, resetText) =>
        page.locator('div')
            .filter({ has: page.getByText(title, { exact: true }) })
            .filter({ has: page.getByRole('button', { name: resetText, exact: true }) })
            .last(),
    filterPanelControl: (panel, label) => panel.getByText(label, { exact: true }).first(),
    filterPanelReset: (panel, resetText) => panel.getByRole('button', { name: resetText, exact: true }),
   // Filter controls are found from their visible label

filterSelect: (panel, label) => panel.getByRole('combobox', { name: label, exact: true }),
filterDateInput: (panel, label) => panel.getByRole('textbox', { name: label, exact: true }),
assessmentRows: (page) => page.locator('tbody tr'),
noResultsMessage: (page, text) => page.getByText(text, { exact: true }),
bottomCount: (page, pattern) => page.getByText(new RegExp(pattern)),
// ---------- Assessments page: search box and pagination ----------
searchBox: (page, name) => page.getByRole('textbox', { name, exact: true }),
searchClear: (page, text) => page.getByRole('button', { name: text, exact: true }),   // exact: does not match "Clear Filters"
paginationButton: (page, navName, number) =>
page.getByRole('navigation', { name: navName }).getByRole('button', { name: String(number), exact: true }),
       // "Clear Filters" button at the top of the page (exact name, so it never matches the search box's "Clear")
clearAllFilters: (page, text) => page.getByRole('button', { name: text, exact: true }),
    // Notes page
    notesPageText: (page, text) => page.getByText(text, { exact: true }),
    noteDetailRow: (page, label) => page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last(),
    noteTextBox: (page, placeholder) => page.getByPlaceholder(placeholder),
    noteCard: (page, text) => page.locator('p').filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).locator('xpath=..'),
    //---------------------------------------------------
    //user locater
    //--------------------------------------------------------------
    
    usersPageTitle: (page, title) => page.getByRole('heading', { name: title, exact: true }),
    // Users page stat card: the innermost block whose text is exactly "<label> <value>" (the value pattern comes from the data file)
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
    // the X icon: a button named "Close", otherwise the first button in the pop-up
    editUserClose: (dialog, name) => dialog.getByRole('button', { name }).or(dialog.locator('button').first()).first(),

    backToUsers: (page, text) =>
        page.getByRole('link', { name: text }).or(page.getByRole('button', { name: text })).first(),

    // Users page: "Notes for <user>" pop-up. The X icon is the button in the same header row as the pop-up title; a note card holds the note text and its "Created:" line
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
  // ---- Products ----
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
    // ---- Profile ----
    profileMenu: (page, name) => page.getByRole('link', { name, exact: true }),
    profilePageTitle: (page, name) => page.getByRole('heading', { name, exact: true }),
    profileSubtitle: (page, text) => page.getByText(text, { exact: true }),
        profileTab: (page, name) => page.getByRole('tab', { name }).or(page.getByRole('button', { name })).first(),
    profileText: (page, text) => page.getByText(text, { exact: true }).first(),
}