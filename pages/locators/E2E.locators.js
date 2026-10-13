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

    // NEW: Recently Completed Assessments card = innermost container holding its heading AND its "view all" button
    recentCompletedCard: (page, title, viewAllText) =>
        page.locator('div')
            .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
            .filter({ has: page.getByRole('button', { name: viewAllText }) })
            .last(),
    recentCompletedTitle: (card, title) => card.getByRole('heading', { name: title, exact: true })
}