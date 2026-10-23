import { expect } from '@playwright/test';
import { E2ELocators } from '../locators/E2E.locators.js';
import { LoginLocators } from '../locators/Login.locators.js';

// Converts [r, g, b] (0-255) to a hue angle (0-360)
const rgbToHue = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};

const escapeForRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- helpers for the legend toggle checks ----

// "rgb(37, 99, 235)" -> [37, 99, 235] (null for transparent / unparsable colors)
const parseRgb = (color) => {
  const m = (color || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  if (p.length > 3 && p[3] === 0) return null;
  return p.slice(0, 3);
};
const isColorful = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) >= 20;   // ignores grey axis/grid lines
const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// A disabled legend entry looks different from its own enabled state (dimmed / struck through / ARIA changed)
const legendDimmed = (look, base, delta) =>
  look.struck !== base.struck ||
  look.aria !== base.aria ||
  look.opacity < base.opacity - delta ||
  (look.textLum !== null && base.textLum !== null && look.textLum > base.textLum + delta) ||
  (look.markerLum !== null && base.markerLum !== null && look.markerLum > base.markerLum + delta);

// ...and an enabled one looks the same as the baseline again
const legendSame = (look, base, delta) =>
  look.struck === base.struck &&
  look.aria === base.aria &&
  Math.abs(look.opacity - base.opacity) <= delta &&
  (look.textLum === null || base.textLum === null || Math.abs(look.textLum - base.textLum) <= delta) &&
  (look.markerLum === null || base.markerLum === null || Math.abs(look.markerLum - base.markerLum) <= delta);

// Path without a trailing slash, so "/assessments" and "/assessments/" count as the same page
const normalizePath = (pathname) => pathname.replace(/\/+$/, '') || '/';

export class E2EPage {
  constructor(page) {
    this.page = page;
    this.logoImage = LoginLocators.logoImage(page);
    this.loginText = LoginLocators.loginText(page);
    this.dashboardClick = E2ELocators.dashboardClick(page);
    this.assessmentClick = E2ELocators.assessmentClick(page);
    this.userClick = E2ELocators.userClick(page);
    this.productClick = E2ELocators.productClick(page);
    this.welcomeTest=E2ELocators.welcomeTest(page);
    this.welcomSubtitle=E2ELocators.welcomSubtitle(page);
  }

  async verifyLogoImage() { await expect(this.logoImage).toBeVisible(); }
  async verifyLoginText() { await expect(this.loginText).toBeVisible(); }
  async clickDashboardClick() { await this.dashboardClick.click(); }
  async clickAssessmentClick() { await this.assessmentClick.click(); }
  async clickUserClick() { await this.userClick.click(); }
  async clickProductClick() { await this.productClick.click(); }

  // ---------- Active tab verification ----------

  // A tab is active if ARIA says so, or if its link points to the current page.
  // No class names or URLs are hardcoded.
  async #getActiveState(tabLabel) {
    const item = E2ELocators.tabItem(tabLabel);
    return item.evaluate((el) => {
      const link = el.matches('a[href]')
        ? el
        : el.querySelector('a[href]') || el.closest('a[href]');

      const ariaActive = [el, link].some(
        (n) =>
          n &&
          (['page', 'true', 'location'].includes(n.getAttribute('aria-current')) ||
            n.getAttribute('aria-selected') === 'true')
      );

      let urlMatches = false;
      if (link) {
        const linkPath = new URL(link.href, location.href).pathname.replace(/\/$/, '');
        const currentPath = location.pathname.replace(/\/$/, '');
        urlMatches = linkPath !== '' && (currentPath === linkPath || currentPath.startsWith(linkPath + '/'));
      }

      return ariaActive || urlMatches;
    });
  }

  // Computed visual styles of the tab item and its label/icon descendants
  async #getVisualStyle(tabLabel) {
    const item = E2ELocators.tabItem(tabLabel);
    return item.evaluate((el) => {
      const pick = (n) => {
        const s = getComputedStyle(n);
        return [
          s.backgroundColor,
          s.color,
          s.fontWeight,
          s.borderLeftColor + s.borderLeftWidth,
          s.borderBottomColor + s.borderBottomWidth,
          s.boxShadow,
          s.opacity,
        ].join('|');
      };
      return [el, ...el.querySelectorAll('*')].map(pick).join('||');
    });
  }

  async verifyTabIsActive(tabLabel) {
    await expect
      .poll(() => this.#getActiveState(tabLabel), {
        message: 'Expected tab to be marked as active',
      })
      .toBe(true);
  }

  async verifyTabIsNotActive(tabLabel) {
    await expect
      .poll(() => this.#getActiveState(tabLabel), {
        message: 'Expected tab NOT to be marked as active',
      })
      .toBe(false);
  }

  // Active tab must look different from an inactive one (no hardcoded colors)
  async verifyTabIsHighlighted(activeTabLabel, inactiveTabLabel) {
    await expect(activeTabLabel).toBeVisible();
    await expect(inactiveTabLabel).toBeVisible();
    await expect
      .poll(
        async () => {
          const active = await this.#getVisualStyle(activeTabLabel);
          const inactive = await this.#getVisualStyle(inactiveTabLabel);
          return active !== inactive;
        },
        { message: 'Active tab has the same styling as an inactive tab' }
      )
      .toBe(true);
  }

  async verifyDashboardTabHighlighted() {
    await this.verifyTabIsActive(this.dashboardClick);
    await this.verifyTabIsHighlighted(this.dashboardClick, this.assessmentClick);
  }
  async verifyWelcomeTest() { await expect(this.welcomeTest).toBeVisible();
}
 async verifyWelcomSubtitle() { await expect(this.welcomSubtitle).toBeVisible();
}

  // ---------- Partner assessment URL ----------

  // Label and link must be visible, and the link must point to the expected URL
  async verifyPartnerAssessmentUrl(labelText, url) {
    await expect(E2ELocators.partnerAssessmentLabel(this.page, labelText)).toBeVisible();
    const link = E2ELocators.partnerAssessmentLink(this.page, url);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', url);
  }

  // Click the link, wait for the new tab, verify it opened the right site, then close it
  async clickPartnerAssessmentUrlAndClose(url) {
    const link = E2ELocators.partnerAssessmentLink(this.page, url);
    const expectedHost = new URL(url).hostname;

    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      link.click(),
    ]);

    await newPage.waitForLoadState('domcontentloaded');
    // The site redirects (/login -> /home), so only the host is asserted
    await expect
      .poll(() => new URL(newPage.url()).hostname, {
        message: 'New tab did not open the partner assessment site',
      })
      .toBe(expectedHost);

    await newPage.close();

    // Back on the original Dashboard tab
    await expect(this.welcomeTest).toBeVisible();
  }

  // ---------- Assign Assessment button ----------

  // Button must be visible and enabled (not clicked)
  async verifyAssignAssessmentButton(buttonName) {
    const button = E2ELocators.assignAssessmentButton(this.page, buttonName);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  }

  // ---------- Dashboard stat cards ----------

  // 1. Every card shows its label and a count (any number, the value itself is never hardcoded)
  async verifyDashboardCards(cards) {
    const countCards = [cards.total, cards.notStarted, cards.inProgress, cards.completed];

    for (const label of countCards) {
      await expect(E2ELocators.dashboardCardLabel(this.page, label), `Label "${label}"`).toBeVisible();
      await expect(E2ELocators.dashboardCardValue(this.page, label), `Value of "${label}"`).toHaveText(/^\s*\d+\s*$/);
    }

    // Completion Rate is a percentage, e.g. 68% (decimals allowed)
    await expect(E2ELocators.dashboardCardLabel(this.page, cards.completionRate)).toBeVisible();
    await expect(
      E2ELocators.dashboardCardValue(this.page, cards.completionRate),
      `Value of "${cards.completionRate}"`
    ).toHaveText(/^\s*\d+(\.\d+)?\s*%\s*$/);
  }

  // 2. Reads the current values, prints them, and returns them as numbers
  async getDashboardCardValues(cards) {
    const read = async (label) => {
      const text = await E2ELocators.dashboardCardValue(this.page, label).innerText();
      return Number(text.replace(/[^\d.]/g, ''));
    };

    const values = {
      total: await read(cards.total),
      notStarted: await read(cards.notStarted),
      inProgress: await read(cards.inProgress),
      completed: await read(cards.completed),
      completionRate: await read(cards.completionRate),
    };

    console.log('----- Dashboard card values -----');
    console.log(`${cards.total}: ${values.total}`);
    console.log(`${cards.notStarted}: ${values.notStarted}`);
    console.log(`${cards.inProgress}: ${values.inProgress}`);
    console.log(`${cards.completed}: ${values.completed}`);
    console.log(`${cards.completionRate}: ${values.completionRate}%`);

    return values;
  }

  // 3. Not Started + In Progress + Completed must equal Total
  verifyCardsSum(cards, values) {
    const sum = values.notStarted + values.inProgress + values.completed;
    console.log(
      `Sum: ${cards.notStarted} (${values.notStarted}) + ${cards.inProgress} (${values.inProgress}) + ` +
      `${cards.completed} (${values.completed}) = ${sum} | ${cards.total}: ${values.total}`
    );
    expect(sum, `Sum of Not Started + In Progress + Completed should equal ${cards.total}`).toBe(values.total);
  }

  // 4. Completion Rate = Completed / Total x 100 (displayed rate is rounded, so allow 0.5 difference)
  verifyCompletionRate(cards, values) {
    expect(values.total, `${cards.total} must be greater than 0 to calculate the rate`).toBeGreaterThan(0);
    const calculated = (values.completed / values.total) * 100;
    console.log(
      `Completion Rate: ${values.completed} / ${values.total} x 100 = ${calculated.toFixed(2)}% | Displayed: ${values.completionRate}%`
    );
    expect(
      Math.abs(calculated - values.completionRate),
      `Displayed ${cards.completionRate} should match Completed / Total x 100`
    ).toBeLessThanOrEqual(0.5);
  }

  // ---------- Monthly Assessment Trends chart ----------

  #chartCard(cfg) {
    return E2ELocators.chartCard(this.page, cfg.title, cfg.legend[0]);
  }

  // Unique axis labels in DOM order.
  // - Labels are read ONLY from inside the chart canvas, so a hover tooltip is never mistaken for an axis label.
  // - Only LEAF elements (no child elements) are used. A wrapper element around a tick label reports
  //   the label text twice (the Y tick "50" became "5050", which also matches the 4-digit year pattern).
  async #getAxisLabels(card, pattern) {
    const canvas = E2ELocators.chartSvg(card);
    const raw = await E2ELocators.chartAxisLabels(canvas, pattern).evaluateAll(
      (elements) => elements.filter((el) => el.children.length === 0).map((el) => el.textContent)
    );
    return [...new Set(raw.map((t) => t.trim()).filter(Boolean))];
  }

  // Reads the real marker color of a legend entry as [r, g, b]
  async #getLegendColor(card, name) {
    return E2ELocators.chartLegendText(card, name).evaluate((el) => {
      const parse = (c) => {
        const m = (c || '').match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        const [r, g, b] = p;
        const a = p.length > 3 ? p[3] : 1;
        if (a === 0) return null;
        // Ignore grays/blacks (text color), only a real marker color counts
        if (Math.max(r, g, b) - Math.min(r, g, b) < 20) return null;
        return [r, g, b];
      };
      const search = (root) => {
        for (const n of [root, ...root.querySelectorAll('*')]) {
          const s = getComputedStyle(n);
          for (const value of [s.backgroundColor, s.fill, s.stroke]) {
            const rgb = parse(value);
            if (rgb) return rgb;
          }
        }
        return null;
      };
      // Marker may be a sibling of the text, so fall back to the parent legend item
      return search(el) || (el.parentElement ? search(el.parentElement) : null);
    });
  }

  // Finds the tooltip by its CONTENT, not by class/role (works with any chart library):
  // the smallest VISIBLE element that holds a month and a "Series: number" pair for every legend entry.
  // Returns { month, values } or null when no complete tooltip is on screen right now.
  async #readTooltip(cfg) {
    const monthPattern = cfg.tooltip.monthPattern;
    const valuePatterns = cfg.legend.map(
      (name) => `${escapeForRegex(name)}\\s*:\\s*(-?\\d[\\d,]*\\.?\\d*)`
    );

    return this.page.evaluate(({ monthPattern, valuePatterns }) => {
      const monthRe = new RegExp(monthPattern);
      const valueRes = valuePatterns.map((p) => new RegExp(p));

      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // a tooltip that is hidden after the mouse leaves keeps its old text, so check every ancestor
        for (let n = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        }
        return true;
      };

      const candidates = [...document.body.querySelectorAll('*')].filter((el) => {
        const text = el.textContent || '';
        return monthRe.test(text) && valueRes.every((re) => re.test(text)) && isVisible(el);
      });
      // keep only the innermost match (drop the wrappers that contain it)
      const innermost = candidates.filter((el) => !candidates.some((o) => o !== el && el.contains(o)));
      if (innermost.length === 0) return null;

      const text = innermost[0].textContent;
      const values = {};
      valuePatterns.forEach((p, i) => {
        values[i] = Number(text.match(new RegExp(p))[1].replace(/,/g, ''));
      });
      return { month: text.match(monthRe)[0], values };
    }, { monthPattern, valuePatterns }).then((result) => {
      if (!result) return null;
      const named = {};
      cfg.legend.forEach((name, i) => { named[name] = result.values[i]; });
      return { month: result.month, values: named };
    });
  }

  // 1a. Chart is rendered with its title
  async verifyTrendChartRendered(cfg) {
    const card = this.#chartCard(cfg);
    await expect(E2ELocators.chartTitle(card, cfg.title), 'Chart title').toBeVisible();

    const svg = E2ELocators.chartSvg(card);
    await expect(svg, 'Chart canvas').toBeVisible();
    const box = await svg.boundingBox();
    expect(box && box.width > 0 && box.height > 0, 'Chart canvas should have a real size').toBe(true);
    await expect(svg.locator('path'), 'Chart should draw lines/areas').not.toHaveCount(0);
  }

  // 1b. X and Y axes show labels
  async verifyTrendChartAxes(cfg) {
    const card = this.#chartCard(cfg);

    // The mouse can still be resting on the chart from an earlier action, which opens a tooltip.
    // Park it away from the chart so the axis check starts from a clean state.
    await this.page.mouse.move(0, 0);

    await expect
      .poll(async () => (await this.#getAxisLabels(card, cfg.axisLabelPattern.x)).length, {
        message: 'X-axis should show month labels',
      })
      .toBeGreaterThan(1);
    await expect
      .poll(async () => (await this.#getAxisLabels(card, cfg.axisLabelPattern.y)).length, {
        message: 'Y-axis should show numeric labels',
      })
      .toBeGreaterThan(1);

    const xLabels = await this.#getAxisLabels(card, cfg.axisLabelPattern.x);
    const yValues = (await this.#getAxisLabels(card, cfg.axisLabelPattern.y)).map(Number);

    const ascending = yValues.every((v, i, a) => i === 0 || v > a[i - 1]);
    const descending = yValues.every((v, i, a) => i === 0 || v < a[i - 1]);
    expect(ascending || descending, `Y-axis labels should be in a consistent order (got: ${yValues.join(', ')})`).toBe(true);

    console.log('----- Chart axes -----');
    console.log(`X-axis (${xLabels.length}): ${xLabels.join(', ')}`);
    console.log(`Y-axis (${yValues.length}): ${yValues.join(', ')}`);
  }

  // 1c. Legend shows each series, with the expected color family (blue / orange)
  async verifyTrendChartLegend(cfg) {
    const card = this.#chartCard(cfg);

    for (const name of cfg.legend) {
      await expect(E2ELocators.chartLegendText(card, name), `Legend "${name}"`).toBeVisible();

      const expected = cfg.legendColors[name];
      const rgb = await this.#getLegendColor(card, name);
      expect(rgb, `Could not read the legend marker color of "${name}"`).not.toBeNull();

      const hue = rgbToHue(rgb);
      console.log(`Legend "${name}": rgb(${rgb.join(', ')}) hue ${hue.toFixed(0)} (expected ${expected.name})`);
      expect(hue, `"${name}" should be ${expected.name}`).toBeGreaterThanOrEqual(expected.hueMin);
      expect(hue, `"${name}" should be ${expected.name}`).toBeLessThanOrEqual(expected.hueMax);
    }
  }

  // 2. Hover across the plot: tooltip months must match the x-axis, each with a value per series
  async verifyTrendChartTooltip(cfg) {
    const card = this.#chartCard(cfg);
    const svg = E2ELocators.chartSvg(card);

    // Start from a clean state. Park the mouse BEFORE scrolling (scrolling can bring the chart under
    // a resting pointer and open a tooltip), then give any open tooltip a moment to close.
    await this.page.mouse.move(0, 0);
    await svg.scrollIntoViewIfNeeded();
    await expect
      .poll(() => this.#readTooltip(cfg), { timeout: 1000, intervals: [50, 100, 200] })
      .toBeNull()
      .catch(() => {});   // best effort only; the check below does not depend on it

    const xLabels = await this.#getAxisLabels(card, cfg.axisLabelPattern.x);
    const box = await svg.boundingBox();
    expect(box, 'Chart canvas must have a bounding box').not.toBeNull();

    const y = box.y + box.height * cfg.tooltip.hoverYRatio;
    const seen = new Map();

    for (let x = box.x + 1; x < box.x + box.width; x += cfg.tooltip.stepPx) {
      await this.page.mouse.move(x, y, { steps: 2 });

      // Wait (auto-retry) until a COMPLETE tooltip (month + every series value) is visible.
      // Positions that show no tooltip are skipped.
      let reading = null;
      try {
        await expect
          .poll(async () => (reading = await this.#readTooltip(cfg)) !== null, {
            timeout: cfg.tooltip.waitMs,
            intervals: [50, 100, 200],
          })
          .toBe(true);
      } catch {
        continue;
      }

      // Only complete readings are stored, so a partial/stale one can never lock a month in
      if (!seen.has(reading.month)) seen.set(reading.month, reading.values);
    }

    // Move away so the tooltip does not stay on screen
    await this.page.mouse.move(0, 0);

    // Sorted for readable output (the order in which months were discovered is not meaningful)
    const seenMonths = [...seen.keys()].sort();

    console.log('----- Chart tooltip values -----');
    for (const month of seenMonths) {
      const values = seen.get(month);
      console.log(`${month} -> ${cfg.legend.map((n) => `${n}: ${values[n]}`).join(' | ')}`);
    }

    expect(
      seen.size,
      'No tooltip showing a month and a value for every legend series appeared while hovering the chart'
    ).toBeGreaterThan(0);

    // Compare coverage (same set of months), not the order they were discovered in
    expect(
      seenMonths,
      'Tooltip months should cover every x-axis month, with no unexpected months'
    ).toEqual([...xLabels].sort());

    for (const [month, values] of seen) {
      for (const name of cfg.legend) {
        expect(values[name], `Tooltip for ${month} should show a value for "${name}"`).not.toBeNull();
        expect(values[name], `Tooltip value of "${name}" for ${month} should not be negative`).toBeGreaterThanOrEqual(0);
      }
    }
  }

  // ---------- Trend period dropdown (Daily / Weekly / Monthly / Yearly) ----------

  // The dropdown is located through its first option, so no index or class name is needed
  #periodSelect(cfg) {
    return E2ELocators.trendPeriodSelect(this.page, cfg.periodDropdown.periods[0].option);
  }

  // Waits for the chart of one period to finish loading, then checks it is really drawn.
  // The card title changes per period (Daily/Weekly/...), so it comes from the data file.
  async #verifyPeriodChartDisplayed(cfg, period, previousLabels, mustChange) {
    const dd = cfg.periodDropdown;
    const card = E2ELocators.chartCard(this.page, period.title, cfg.legend[0]);

    // Title switches to the selected period, "Loading chart data..." disappears, legend is back
    await expect(E2ELocators.chartTitle(card, period.title), `Title for "${period.option}"`).toBeVisible();
    await expect(E2ELocators.trendChartLoading(this.page, dd.loadingText), 'Chart should finish loading').toBeHidden();
    for (const name of cfg.legend) {
      await expect(E2ELocators.chartLegendText(card, name), `Legend "${name}" for "${period.option}"`).toBeVisible();
    }

    // Graph is drawn: canvas has a size and contains lines/areas
    const svg = E2ELocators.chartSvg(card);
    await expect(svg, `Chart canvas for "${period.option}"`).toBeVisible();
    const box = await svg.boundingBox();
    expect(box && box.width > 0 && box.height > 0, `Chart canvas for "${period.option}" should have a real size`).toBe(true);
    await expect(svg.locator('path'), `Chart for "${period.option}" should draw lines/areas`).not.toHaveCount(0);

    // Wait for the x-axis to SETTLE: labels are non-empty, in chronological order, different from the
    // previous chart (when the period changed), and identical to the reading before it.
    let labels = [];
    let lastKey = null;
    try {
      await expect
        .poll(
          async () => {
            labels = await this.#getAxisLabels(card, period.xPattern);
            const key = labels.join('|');
            const valid =
              labels.length > 0 &&
              key === [...labels].sort().join('|') &&
              (!mustChange || key !== previousLabels.join('|'));
            const stable = valid && key === lastKey;
            lastKey = key;
            return stable;
          },
          {
            message: `X-axis for "${period.option}" should settle on new, chronologically ordered labels matching /${period.xPattern}/`,
            intervals: [100, 200, 300],
            timeout: 10_000,
          }
        )
        .toBe(true);
    } catch (error) {
      throw new Error(`${error.message}\nLast x-axis labels read: ${labels.join(', ') || '(none)'}`);
    }

    console.log(`${period.option} -> "${period.title}" | x-axis (${labels.length}): ${labels.join(', ')}`);
    return labels;
  }

  // 1. Click the dropdown arrow and verify every period option is present
  async verifyTrendPeriodOptions(cfg) {
    const periods = cfg.periodDropdown.periods;
    const select = this.#periodSelect(cfg);

    await select.scrollIntoViewIfNeeded();
    await expect(select, 'Trend period dropdown').toBeVisible();
    await expect(select, 'Trend period dropdown').toBeEnabled();

    await select.click();   // open the dropdown
    await expect(select.locator('option'), 'Dropdown options').toHaveText(periods.map((p) => p.option));
    await this.page.keyboard.press('Escape');   // close the native popup

    console.log(`Dropdown options: ${periods.map((p) => p.option).join(', ')}`);
  }

  // 2. Select each option and verify the graph is displayed. The original selection is restored at the end.
  async verifyTrendPeriodCharts(cfg) {
    const periods = cfg.periodDropdown.periods;
    const select = this.#periodSelect(cfg);
    const checked = select.locator('option:checked');

    const originalOption = (await checked.innerText()).trim();
    const original = periods.find((p) => p.option === originalOption);
    let previousOption = originalOption;
    let previousLabels = original
      ? await this.#getAxisLabels(E2ELocators.chartCard(this.page, original.title, cfg.legend[0]), original.xPattern)
      : [];

    console.log('----- Trend period dropdown -----');
    for (const period of periods) {
      await select.selectOption({ label: period.option });
      await expect(checked, `"${period.option}" should be selected`).toHaveText(period.option);

      previousLabels = await this.#verifyPeriodChartDisplayed(
        cfg,
        period,
        previousLabels,
        period.option !== previousOption
      );
      previousOption = period.option;
    }

    // Put the dropdown back on its original option so the rest of the test is unaffected
    if (previousOption !== originalOption) {
      await select.selectOption({ label: originalOption });
      await expect(checked).toHaveText(originalOption);
      if (original) {
        const card = E2ELocators.chartCard(this.page, original.title, cfg.legend[0]);
        await expect(E2ELocators.chartTitle(card, original.title), 'Original chart restored').toBeVisible();
      }
    }
  }

  // ---------- Legend toggle (click Assigned / Completed to disable and enable a series) ----------

  // How a legend entry looks right now: opacity, text/marker lightness, strike-through and ARIA state.
  // Compared only against the entry's OWN enabled state, so no colors or numbers are hardcoded.
  async #getLegendLook(card, name) {
    return E2ELocators.chartLegendText(card, name).evaluate((el) => {
      const luminance = (color) => {
        const m = (color || '').match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        if (p.length > 3 && p[3] === 0) return null;
        const f = (v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
      };

      // effective opacity = product of the opacity of the entry and all its ancestors
      let opacity = 1;
      for (let n = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);

      // marker (the dot): inside the entry first, then its pseudo-elements, then empty siblings
      const parent = el.parentElement;
      const candidates = [...el.querySelectorAll('*')].map((n) => [n, null]);
      candidates.push([el, '::before'], [el, '::after']);
      if (parent) {
        [...parent.children]
          .filter((n) => n !== el && (n.textContent || '').trim() === '')
          .forEach((n) => candidates.push([n, null]));
      }
      let markerLum = null;
      for (const [n, pseudo] of candidates) {
        const s = getComputedStyle(n, pseudo);
        const lum = luminance(s.backgroundColor) ?? luminance(s.fill);
        if (lum !== null) { markerLum = lum; break; }
      }

      const struck = [el, parent].some((n) => n && getComputedStyle(n).textDecorationLine.includes('line-through'));
      const stateEl = el.closest('[aria-pressed],[aria-checked],[aria-selected],[aria-disabled]');
      const aria = stateEl
        ? ['aria-pressed', 'aria-checked', 'aria-selected', 'aria-disabled'].map((a) => stateEl.getAttribute(a)).join('|')
        : '';

      return { opacity, textLum: luminance(getComputedStyle(el).color), markerLum, struck, aria };
    });
  }

  // What the chart currently draws: number of visible paths, and how many of them use each series' color
  async #readChartState(card, hues, tolerance) {
    const strokes = await E2ELocators.chartSvg(card).evaluate((svg) => {
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        for (let n = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        }
        return true;
      };
      return [...svg.querySelectorAll('path')].filter(isVisible).map((p) => getComputedStyle(p).stroke);
    });

    const counts = {};
    for (const [name, hue] of Object.entries(hues)) {
      counts[name] = strokes.filter((stroke) => {
        const rgb = parseRgb(stroke);
        return rgb && isColorful(rgb) && hueDistance(rgbToHue(rgb), hue) <= tolerance;
      }).length;
    }
    return { total: strokes.length, counts };
  }

  // Waits until two consecutive readings are identical (the chart has finished drawing / animating)
  async #readStableChartState(card, hues, tolerance) {
    let state = null;
    let lastKey = null;
    await expect
      .poll(
        async () => {
          state = await this.#readChartState(card, hues, tolerance);
          const key = JSON.stringify([state.total, state.counts]);
          const stable = key === lastKey;
          lastKey = key;
          return stable;
        },
        { message: 'Chart should finish drawing', intervals: [100, 200, 300] }
      )
      .toBe(true);
    return state;
  }

  // Click each legend entry: the series must disappear and the legend must look disabled,
  // click again: both must go back to normal.
  async verifyTrendLegendToggle(cfg) {
    const tg = cfg.legendToggle;
    const card = this.#chartCard(cfg);
    const svg = E2ELocators.chartSvg(card);

    await this.page.mouse.move(0, 0);
    await svg.scrollIntoViewIfNeeded();

    // Baseline: both series enabled. The series color is read from the legend marker.
    const hues = {};
    const baseLook = {};
    for (const name of cfg.legend) {
      await expect(E2ELocators.chartLegendText(card, name), `Legend "${name}"`).toBeVisible();
      const rgb = await this.#getLegendColor(card, name);
      expect(rgb, `Could not read the legend marker color of "${name}"`).not.toBeNull();
      hues[name] = rgbToHue(rgb);
      baseLook[name] = await this.#getLegendLook(card, name);
    }
    const base = await this.#readStableChartState(card, hues, tg.hueTolerance);

    console.log('----- Legend toggle -----');
    console.log(
      `Baseline: ${cfg.legend.map((n) => `${n} paths ${base.counts[n]}`).join(', ')} | total visible paths ${base.total}`
    );

    for (const name of cfg.legend) {
      const legend = E2ELocators.chartLegendText(card, name);
      const others = cfg.legend.filter((n) => n !== name);
      // when the series color can be found in the chart, check that exact series; otherwise compare path totals
      const colorUsable = base.counts[name] > 0;

      // ---- disable: click the legend entry ----
      await legend.click();
      await this.page.mouse.move(0, 0);   // keep hover styling out of the comparison

      await expect
        .poll(async () => legendDimmed(await this.#getLegendLook(card, name), baseLook[name], tg.dimDelta), {
          message: `Legend "${name}" should look disabled after the click`,
        })
        .toBe(true);

      let off = null;
      await expect
        .poll(
          async () => {
            off = await this.#readChartState(card, hues, tg.hueTolerance);
            return colorUsable ? off.counts[name] === 0 : off.total < base.total;
          },
          { message: `"${name}" should disappear from the chart after the click` }
        )
        .toBe(true);

      for (const other of others) {
        if (base.counts[other] > 0) {
          expect(off.counts[other], `"${other}" should still be drawn while "${name}" is disabled`).toBeGreaterThan(0);
        }
        expect(
          legendDimmed(await this.#getLegendLook(card, other), baseLook[other], tg.dimDelta),
          `Legend "${other}" should stay enabled while "${name}" is disabled`
        ).toBe(false);
      }

      // ---- enable: click again ----
      await legend.click();
      await this.page.mouse.move(0, 0);

      await expect
        .poll(async () => legendSame(await this.#getLegendLook(card, name), baseLook[name], tg.dimDelta), {
          message: `Legend "${name}" should look enabled again after the second click`,
        })
        .toBe(true);

      let on = null;
      await expect
        .poll(
          async () => {
            on = await this.#readChartState(card, hues, tg.hueTolerance);
            return on.total === base.total && (!colorUsable || on.counts[name] === base.counts[name]);
          },
          { message: `"${name}" should be drawn in the chart again after the second click` }
        )
        .toBe(true);

      console.log(
        `${name}: disabled -> legend dimmed, ${colorUsable ? `${off.counts[name]} series paths` : `${off.total} total paths`} ` +
        `(was ${colorUsable ? base.counts[name] : base.total}) | enabled -> restored (${on.total} total paths)`
      );
    }

    await this.page.mouse.move(0, 0);
  }

  // ---------- Recently Completed Assessments ----------

  // Reads every item of the card. Items are found through their "Completed" badge, then the item row is the
  // largest ancestor that holds only that one badge. Nothing depends on class names, row numbers or text values.
  async #readRecentCompleted(card, rc) {
    return card.evaluate((root, { badgeText }) => {
      const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        for (let n = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        }
        return true;
      };

      const heading = root.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
      const badges = [...root.querySelectorAll('*')].filter(
        (el) => el.children.length === 0 && norm(el.textContent) === badgeText
      );

      // climb from the badge while the parent still holds only this item (not other badges, the heading or a button)
      const rowOf = (badge) => {
        let row = badge;
        while (row.parentElement && row.parentElement !== root) {
          const parent = row.parentElement;
          const holdsOtherBadges = badges.filter((b) => parent.contains(b)).length > 1;
          const holdsChrome = (heading && parent.contains(heading)) || parent.querySelector('button');
          if (holdsOtherBadges || holdsChrome) break;
          row = parent;
        }
        return row;
      };

      return badges.map((badge) => {
        const row = rowOf(badge);
        const meta = badge.parentElement;

        // every piece of text inside the row, with the element that holds it
        const pieces = [];
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = norm(n.textContent);
          if (text) pieces.push({ text, el: n.parentElement });
        }

        const glyph = pieces.find((p) => /^[\u2713\u2714\u2705\u2611]$/.test(p.text));   // a check drawn as a text character
        const rest = pieces.filter((p) => p.el !== badge && p !== glyph);

        // date/time: the text sitting next to the badge; otherwise any piece that reads as a date
        const ownDate = [...meta.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => norm(n.textContent))
          .filter(Boolean)
          .join(' ');
        const datePiece = ownDate ? null : rest.find((p) => !Number.isNaN(Date.parse(p.text)));
        const dateText = ownDate || (datePiece ? datePiece.text : '');
        const nameText = rest
          .filter((p) => (ownDate ? p.el !== meta : p !== datePiece))
          .map((p) => p.text)
          .join(' ');

        // icon: a visible svg / img / icon element in the row
        const findIcon = (selector) => [...row.querySelectorAll(selector)].find(isVisible);
        const icon = findIcon('svg, img, i, [role="img"]') || findIcon('[class*="icon" i]');
        const iconMarkup = icon ? norm(icon.outerHTML) : glyph ? glyph.text : '';

        return {
          name: nameText,
          badge: norm(badge.textContent),
          badgeVisible: isVisible(badge),
          dateText,
          hasIcon: Boolean(icon || glyph),
          iconMarkup,
          iconHint: /check|tick/i.test(iconMarkup) || Boolean(glyph),
          top: Math.round(row.getBoundingClientRect().top),
        };
      });
    }, { badgeText: rc.badgeText });
  }

  // 1. print the values, 2. check every item has icon + name + badge + date/time, 3. check latest completed first
  async verifyRecentCompletedAssessments(rc) {
    const card = E2ELocators.recentCompletedCard(this.page, rc.title, rc.viewAllText);

    await card.scrollIntoViewIfNeeded();
    await expect(E2ELocators.recentCompletedTitle(card, rc.title), 'Recently Completed Assessments heading').toBeVisible();

    // wait until the list has loaded and stopped changing
    let items = [];
    let lastKey = null;
    await expect
      .poll(
        async () => {
          items = await this.#readRecentCompleted(card, rc);
          const key = JSON.stringify(items);
          const stable = items.length > 0 && key === lastKey;
          lastKey = key;
          return stable;
        },
        { message: `"${rc.title}" should list at least one completed assessment`, intervals: [100, 200, 300] }
      )
      .toBe(true);

    // 1. print the values
    console.log('----- Recently Completed Assessments -----');
    console.log(`Items shown: ${items.length}`);
    items.forEach((item, i) => {
      console.log(`${i + 1}. ${item.name} | ${item.badge} | ${item.dateText} | check icon: ${item.hasIcon ? 'yes' : 'NO'}`);
    });
    console.log(`Icon markup mentions "check": ${items.every((item) => item.iconHint) ? 'yes' : 'no (icon is present, shape not named in its markup)'}`);

    // 2. every item has icon, name, "Completed" badge and a date/time (any value, it only has to be shown)
    const timeRegex = new RegExp(rc.timePattern);
    items.forEach((item, i) => {
      const label = `Item ${i + 1} ("${item.name}")`;
      expect.soft(item.hasIcon, `${label} should show a check icon`).toBe(true);
      expect.soft(item.name.length, `${label} should show a name`).toBeGreaterThan(0);
      expect.soft(item.badge, `${label} should show the "${rc.badgeText}" badge`).toBe(rc.badgeText);
      expect.soft(item.badgeVisible, `${label} badge should be visible`).toBe(true);
      expect.soft(item.dateText.length, `${label} should show a date/time`).toBeGreaterThan(0);
      expect.soft(Number.isNaN(Date.parse(item.dateText)), `${label} date "${item.dateText}" should be a readable date`).toBe(false);
      expect.soft(timeRegex.test(item.dateText), `${label} date "${item.dateText}" should include a time`).toBe(true);
    });
    expect.soft(
      new Set(items.map((item) => item.iconMarkup)).size,
      'Every item should use the same check icon'
    ).toBe(1);

    // 3. sort order: latest completed first (each item is the same as or older than the one above it)
    const timestamps = items.map((item) => Date.parse(item.dateText));
    expect(
      timestamps.every((t) => !Number.isNaN(t)),
      'All dates must be readable before the sort order can be checked'
    ).toBe(true);

    const latestFirst = timestamps.every((t, i) => i === 0 || t <= timestamps[i - 1]);
    console.log(`Sort order (latest completed first): ${latestFirst ? 'OK' : 'WRONG'}`);
    expect(
      latestFirst,
      `Items should be sorted latest completed first. Dates shown: ${items.map((item) => item.dateText).join(' | ')}`
    ).toBe(true);

    // the rows must also appear on screen in that same order
    expect.soft(
      items.every((item, i) => i === 0 || item.top >= items[i - 1].top),
      'Items should be displayed from top to bottom in the order they were read'
    ).toBe(true);
  }

  // ---------- NEW: "View all completed assessments →" redirects to the Assessments page ----------

  // Clicks the link and verifies the Assessments page opens, then returns to the Dashboard so later steps are unaffected.
  async verifyViewAllCompletedRedirect(rc, ap) {
    const card = E2ELocators.recentCompletedCard(this.page, rc.title, rc.viewAllText);
    const viewAll = E2ELocators.recentCompletedViewAll(card, rc.viewAllText);
    const dashboardUrl = this.page.url();

    // Where the Assessments page lives is taken from the Assessments tab's own link, not typed here
    const href = await E2ELocators.tabItem(this.assessmentClick).evaluate((el) => {
      const link = el.matches('a[href]') ? el : el.querySelector('a[href]') || el.closest('a[href]');
      return link ? link.getAttribute('href') : null;
    });
    expect(href, 'The Assessments tab should be a link, so the expected page can be read from it').not.toBeNull();
    const expectedPath = normalizePath(new URL(href, dashboardUrl).pathname);

    // Click the link
    await card.scrollIntoViewIfNeeded();
    await expect(viewAll, `"${rc.viewAllText}" link`).toBeVisible();
    await expect(viewAll, `"${rc.viewAllText}" link`).toBeEnabled();
    await viewAll.click();

    // Redirected to the Assessments page
    await expect(this.page, `Clicking "${rc.viewAllText}" should open the page at ${expectedPath}`).toHaveURL(
      (url) => normalizePath(url.pathname) === expectedPath,
      { timeout: ap.loadTimeoutMs }
    );
    expect(this.page.url(), 'The URL should change after the click').not.toBe(dashboardUrl);
    await this.verifyTabIsActive(this.assessmentClick);

    // The page itself has loaded: heading shown, loading message gone, and a list with a total above zero
    await expect(E2ELocators.assessmentsHeading(this.page, ap.heading), `"${ap.heading}" heading`).toBeVisible({
      timeout: ap.loadTimeoutMs,
    });
    await expect(E2ELocators.assessmentsLoading(this.page, ap.loadingText), 'Assessments should finish loading').toBeHidden({
      timeout: ap.loadTimeoutMs,
    });

    const count = E2ELocators.assessmentsCount(this.page, ap.countPattern);
    await expect(count, 'Assessments count line').toBeVisible();
    let total = 0;
    await expect
      .poll(
        async () => {
          // the total is the last number of the "Showing x - y of N assessments" line
          const numbers = (await count.innerText()).match(/\d[\d,]*/g) || [];
          total = numbers.length ? Number(numbers[numbers.length - 1].replace(/,/g, '')) : 0;
          return total;
        },
        {
          message: 'The Assessments page should list assessments (the Dashboard just showed completed ones)',
          timeout: ap.loadTimeoutMs,
        }
      )
      .toBeGreaterThan(0);

    console.log('----- View all completed assessments -----');
    console.log(`Clicked "${rc.viewAllText}" -> ${this.page.url()}`);
    console.log(`Assessments page: "${ap.heading}" | ${(await count.innerText()).trim()} | total ${total}`);

    // Back to the Dashboard so the steps that follow run exactly as before
    await this.dashboardClick.click();
    await this.verifyTabIsActive(this.dashboardClick);
    await this.verifyWelcomeTest();
  }
  //--------------------------------------
  //Assessment page
  //---------------------------------------

  // The page title is the heading of the Assessments page. The text comes from the data file.
async verifyAssessmentsPageTitle(title, timeout) {
    // a missing data value now fails with a clear message instead of "expected value must be a string"
    expect(title, 'assessmentsPage.pageTitle is missing in E2EData.json').toBeTruthy();

    const heading = E2ELocators.assessmentsPageTitle(this.page, title);
    await expect(heading, `Page title "${title}"`).toBeVisible({ timeout });
    await expect(heading, `Page title "${title}"`).toHaveText(title);
    console.log(`Page title shown: "${(await heading.innerText()).trim()}"`);
  }

  // The page remembers the last state of the panel, so it is not assumed: first make sure it is hidden
  async resetFilterPanelToHidden(fp) {
    const showBtn = E2ELocators.filterToggle(this.page, fp.showButton);
    const hideBtn = E2ELocators.filterToggle(this.page, fp.hideButton);

    await expect(showBtn.or(hideBtn), 'The filter toggle button').toBeVisible();
    if (await hideBtn.isVisible()) {
      await hideBtn.click();
    }
    await expect(showBtn, `"${fp.showButton}" button`).toBeVisible();
    await expect(E2ELocators.filterPanelTitle(this.page, fp.panelTitle), `"${fp.panelTitle}" panel`).toBeHidden();
  }

  // 1. Click "Show Filters"
  async clickShowFilters(fp) {
    const showBtn = E2ELocators.filterToggle(this.page, fp.showButton);
    await expect(showBtn, `"${fp.showButton}" button`).toBeVisible();
    await expect(showBtn, `"${fp.showButton}" button`).toBeEnabled();
    await showBtn.click();
  }

  // 2. The "Filter Assessments" panel is displayed with its filters, and the button now reads "Hide Filters"
  async verifyFilterPanelDisplayed(fp) {
    const panel = E2ELocators.filterPanel(this.page, fp.panelTitle, fp.resetButton);

    await expect(E2ELocators.filterPanelTitle(this.page, fp.panelTitle), `"${fp.panelTitle}" panel title`).toBeVisible();
    for (const label of fp.controls) {
      await expect(E2ELocators.filterPanelControl(panel, label), `Filter "${label}"`).toBeVisible();
    }
    const reset = E2ELocators.filterPanelReset(panel, fp.resetButton);
    await expect(reset, `"${fp.resetButton}" button`).toBeVisible();
    await expect(reset, `"${fp.resetButton}" button`).toBeEnabled();

    // the toggle swaps its label
    await expect(E2ELocators.filterToggle(this.page, fp.hideButton), `"${fp.hideButton}" button`).toBeVisible();
    await expect(E2ELocators.filterToggle(this.page, fp.showButton), `"${fp.showButton}" button`).toBeHidden();

    console.log('----- Filters -----');
    console.log(`"${fp.panelTitle}" displayed: ${fp.controls.join(', ')}, ${fp.resetButton}`);
  }

  // 3. Click "Hide Filters"
  async clickHideFilters(fp) {
    const hideBtn = E2ELocators.filterToggle(this.page, fp.hideButton);
    await expect(hideBtn, `"${fp.hideButton}" button`).toBeVisible();
    await expect(hideBtn, `"${fp.hideButton}" button`).toBeEnabled();
    await hideBtn.click();
  }

  // ...the panel and all its filters are gone, and the button reads "Show Filters" again
  async verifyFilterPanelHidden(fp) {
    const panel = E2ELocators.filterPanel(this.page, fp.panelTitle, fp.resetButton);

    await expect(E2ELocators.filterPanelTitle(this.page, fp.panelTitle), `"${fp.panelTitle}" panel title`).toBeHidden();
    for (const label of fp.controls) {
      await expect(E2ELocators.filterPanelControl(panel, label), `Filter "${label}"`).toBeHidden();
    }
    await expect(E2ELocators.filterPanelReset(panel, fp.resetButton), `"${fp.resetButton}" button`).toBeHidden();

    await expect(E2ELocators.filterToggle(this.page, fp.showButton), `"${fp.showButton}" button`).toBeVisible();
    await expect(E2ELocators.filterToggle(this.page, fp.hideButton), `"${fp.hideButton}" button`).toBeHidden();

    console.log(`"${fp.panelTitle}" hidden after "${fp.hideButton}"`);
  }

//new
  // ---------- NEW: Assessment filters (type, status, date, reset) ----------

  #panel(fp) {
    for (const key of ['typeLabel', 'statusLabel', 'startDateLabel', 'endDateLabel', 'defaultType', 'defaultStatus',
      'statusesToCheck', 'specificTypeIndex', 'noResultsMessage', 'bottomCountPattern', 'settleMs', 'dateFilter']) {
      expect(fp[key], `filterPanel.${key} is missing in E2EData.json`).toBeDefined();
    }
    return E2ELocators.filterPanel(this.page, fp.panelTitle, fp.resetButton);
  }

  // Reads "Showing x - y of N assessments" and returns N
  async #topTotal(ap) {
    const text = await E2ELocators.assessmentsCount(this.page, ap.countPattern).innerText();
    const numbers = text.match(/\d[\d,]*/g) || [];
    return numbers.length ? Number(numbers[numbers.length - 1].replace(/,/g, '')) : 0;
  }

  // Waits for the list to settle and returns what it ended up showing
  async #settledResults(ap, fp) {
    await this.page.waitForTimeout(fp.settleMs); // give the loading state time to start
    const loading = E2ELocators.assessmentsLoading(this.page, ap.loadingText);
    const none = E2ELocators.noResultsMessage(this.page, fp.noResultsMessage);
    const bottom = E2ELocators.bottomCount(this.page, fp.bottomCountPattern);

    await expect(loading, 'Assessments should finish loading').toBeHidden({ timeout: ap.loadTimeoutMs });
    // Results are shown when there is a "no assessments" message, a bottom total, or at least one row
    // (a single page of results has no bottom footer)
    const rows = E2ELocators.assessmentRows(this.page);
    await expect
      .poll(async () => (await none.isVisible()) || (await bottom.first().isVisible()) || (await rows.count()) > 0, {
        message: 'Either results or the "no assessments" message should be displayed',
        timeout: ap.loadTimeoutMs,
      })
      .toBe(true);

    const hasNone = await none.isVisible();
    return { hasNone, total: await this.#topTotal(ap), bottom, none };
  }

  // Result rule: results + bottom total count, otherwise the no-results message
  async #verifyResultsOrMessage(label, ap, fp, rowText) {
    const r = await this.#settledResults(ap, fp);

    if (r.hasNone) {
      await expect(r.none, `${label}: message`).toHaveText(fp.noResultsMessage);
      // The "Showing x - y of N" line above can still show the previous list's numbers when nothing matches,
      // so it is not used here. What matters: the message is shown and no result rows are listed.
      await expect(E2ELocators.assessmentRows(this.page), `${label}: no result rows should be listed`).toHaveCount(0);
      console.log(`${label}: "${fp.noResultsMessage}"`);
      return 0;
    }

    expect(r.total, `${label}: results should be listed`).toBeGreaterThan(0);
    const rowCount = await E2ELocators.assessmentRows(this.page).count();

    let bottomText;
    if (await r.bottom.first().isVisible()) {
      await r.bottom.first().scrollIntoViewIfNeeded();
      await expect(r.bottom.first(), `${label}: bottom total count`).toBeVisible();
      bottomText = (await r.bottom.first().innerText()).trim();
      const bottomTotal = Number((bottomText.match(/\d[\d,]*/g) || ['0']).pop().replace(/,/g, ''));
      expect.soft(bottomTotal, `${label}: bottom total should match the total at the top`).toBe(r.total);
    } else {
      // When everything fits on one page the portal shows no footer; the total at the top must equal the rows shown
      expect.soft(rowCount, `${label}: with no bottom footer, all ${r.total} results should fit on one page`).toBe(r.total);
      bottomText = `(no bottom footer: all ${rowCount} results fit on one page)`;
    }

    // Every row on screen should match the chosen filter (compared ignoring case and punctuation)
    if (rowText) {
      const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rows = await E2ELocators.assessmentRows(this.page).allInnerTexts();
      const bad = rows.filter((row) => !clean(row).includes(clean(rowText)));
      expect.soft(bad.length, `${label}: every row should show "${rowText}"`).toBe(0);
    }
    console.log(`${label}: results shown | top total ${r.total} | bottom: "${bottomText}"`);
    return r.total;
  }

  // Opens the Assessment Type and Status lists, prints their values and checks the defaults
  async verifyFilterDropdownValues(fp) {
    const panel = this.#panel(fp);
    for (const [label, def] of [[fp.typeLabel, fp.defaultType], [fp.statusLabel, fp.defaultStatus]]) {
      const select = E2ELocators.filterSelect(panel, label);
      await expect(select, `${label} dropdown`).toBeVisible();
      const values = (await select.locator('option').allInnerTexts()).map((v) => v.trim());
      const selected = await select.evaluate((el) => el.options[el.selectedIndex].text.trim());
      console.log(`${label} values (${values.length}): ${values.join(' | ')}`);
      console.log(`${label} selected by default: "${selected}"`);
      expect(values, `${label} should offer "${def}"`).toContain(def);
      expect(selected, `${label} default`).toBe(def);
    }
  }

  // "All Types" shows everything with a bottom total; returns the unfiltered total
  async verifyAllTypes(ap, fp) {
    const select = E2ELocators.filterSelect(this.#panel(fp), fp.typeLabel);
    await select.selectOption({ label: fp.defaultType });
    const total = await this.#verifyResultsOrMessage(`Type "${fp.defaultType}"`, ap, fp);
    expect(total, 'All Types should list every assessment').toBeGreaterThan(0);
    return total;
  }

  // Picks one specific type (position comes from the data file) and checks the outcome
  async verifySpecificType(ap, fp) {
    const select = E2ELocators.filterSelect(this.#panel(fp), fp.typeLabel);
    const options = (await select.locator('option').allInnerTexts()).map((v) => v.trim());
    const name = options[Math.min(fp.specificTypeIndex, options.length - 1)];
    await select.selectOption({ label: name });
    await this.#verifyResultsOrMessage(`Type "${name}"`, ap, fp, name);
    await select.selectOption({ label: fp.defaultType }); // back to default for the next step
    await this.#settledResults(ap, fp);
  }

  // "All Statuses" shows everything with a bottom total
  async verifyAllStatuses(ap, fp, expectedTotal) {
    const select = E2ELocators.filterSelect(this.#panel(fp), fp.statusLabel);
    await select.selectOption({ label: fp.defaultStatus });
    const total = await this.#verifyResultsOrMessage(`Status "${fp.defaultStatus}"`, ap, fp);
    expect.soft(total, 'All Statuses should list the same total as All Types').toBe(expectedTotal);
  }

  // Selects one status (name from the data file) and checks results/message
  async verifyStatus(statusName, ap, fp) {
    const select = E2ELocators.filterSelect(this.#panel(fp), fp.statusLabel);
    const options = (await select.locator('option').allInnerTexts()).map((v) => v.trim());
    expect(options, `Status list should contain "${statusName}"`).toContain(statusName);
    await select.selectOption({ label: statusName });
    return this.#verifyResultsOrMessage(`Status "${statusName}"`, ap, fp, statusName);
  }

  // Sets a start/end date relative to today (offsets come from the data file)
  async verifyDateFilter(ap, fp) {
    const panel = this.#panel(fp);
    const iso = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const start = iso(fp.dateFilter.startOffsetDays);
    const end = iso(fp.dateFilter.endOffsetDays);
    await E2ELocators.filterDateInput(panel, fp.startDateLabel).fill(start);
    await E2ELocators.filterDateInput(panel, fp.endDateLabel).fill(end);
    console.log(`Dates selected: ${start} to ${end}`);
    await this.#verifyResultsOrMessage(`Date ${start} to ${end}`, ap, fp);
  }

  // Reset Filters returns every control and the list to the starting state
  async clickResetFilters(ap, fp, expectedTotal) {
    const panel = this.#panel(fp);
    await E2ELocators.filterPanelReset(panel, fp.resetButton).click();
    await this.#settledResults(ap, fp);

    const typeText = await E2ELocators.filterSelect(panel, fp.typeLabel).evaluate((el) => el.options[el.selectedIndex].text.trim());
    const statusText = await E2ELocators.filterSelect(panel, fp.statusLabel).evaluate((el) => el.options[el.selectedIndex].text.trim());
    expect(typeText, 'Assessment Type after reset').toBe(fp.defaultType);
    expect(statusText, 'Status after reset').toBe(fp.defaultStatus);
    await expect(E2ELocators.filterDateInput(panel, fp.startDateLabel), 'Start Date after reset').toHaveValue('');
    await expect(E2ELocators.filterDateInput(panel, fp.endDateLabel), 'End Date after reset').toHaveValue('');
    expect(await this.#topTotal(ap), 'Total after reset').toBe(expectedTotal);
    console.log(`Reset Filters: defaults restored, total back to ${expectedTotal}`);
  }
    // ---------- NEW: combined filters (type + status, type + status + date) ----------

  #combinedConfig(fp) {
    // Uses "combinedFilter" from E2EData.json when present; otherwise falls back to the existing filterPanel values
    return (
      fp.combinedFilter ?? {
        typeIndex: fp.specificTypeIndex,
        status: fp.statusesToCheck[fp.statusesToCheck.length - 1],
        startOffsetDays: fp.dateFilter.startOffsetDays,
        endOffsetDays: fp.dateFilter.endOffsetDays,
      }
    );
  }

  // Every row on screen must contain every selected value (compared ignoring case and punctuation)
  async #verifyRowsMatchAll(label, texts) {
    const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rows = await E2ELocators.assessmentRows(this.page).allInnerTexts();
    for (const text of texts) {
      const bad = rows.filter((row) => !clean(row).includes(clean(text)));
      expect.soft(bad.length, `${label}: every row should show "${text}"`).toBe(0);
    }
  }

  // 1. Assessment Type + Status together. Returns the combined total.
  async verifyTypeAndStatusFilter(ap, fp) {
    const cf = this.#combinedConfig(fp);
    const panel = this.#panel(fp);
    const typeSelect = E2ELocators.filterSelect(panel, fp.typeLabel);
    const statusSelect = E2ELocators.filterSelect(panel, fp.statusLabel);

    const types = (await typeSelect.locator('option').allInnerTexts()).map((v) => v.trim());
    const typeName = types[Math.min(cf.typeIndex, types.length - 1)];
    const statuses = (await statusSelect.locator('option').allInnerTexts()).map((v) => v.trim());
    expect(statuses, `Status list should contain "${cf.status}"`).toContain(cf.status);

    console.log('----- Combined filters: Type + Status -----');

    // Type alone first, so the combination can be compared with it
    await typeSelect.selectOption({ label: typeName });
    const typeOnly = await this.#verifyResultsOrMessage(`Type "${typeName}"`, ap, fp, typeName);

    // Add the status on top
    await statusSelect.selectOption({ label: cf.status });
    const label = `Type "${typeName}" + Status "${cf.status}"`;
    const combined = await this.#verifyResultsOrMessage(label, ap, fp);
    if (combined > 0) {
      await this.#verifyRowsMatchAll(label, [typeName, cf.status]);
    }
    expect.soft(combined, `${label}: combining filters can only narrow the results (type alone: ${typeOnly})`).toBeLessThanOrEqual(typeOnly);
    return combined;
  }

  // 2. Assessment Type + Status + Date together (type and status stay selected from the previous step)
  async verifyTypeStatusAndDateFilter(ap, fp, typeStatusTotal) {
    const cf = this.#combinedConfig(fp);
    const panel = this.#panel(fp);

    const typeSelect = E2ELocators.filterSelect(panel, fp.typeLabel);
    const statusSelect = E2ELocators.filterSelect(panel, fp.statusLabel);
    const typeName = (await typeSelect.evaluate((el) => el.options[el.selectedIndex].text)).trim();
    const statusName = (await statusSelect.evaluate((el) => el.options[el.selectedIndex].text)).trim();
    expect(typeName, 'Assessment Type should still be selected from the previous step').not.toBe(fp.defaultType);
    expect(statusName, 'Status should still be selected from the previous step').not.toBe(fp.defaultStatus);

    const iso = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const start = iso(cf.startOffsetDays);
    const end = iso(cf.endOffsetDays);

    console.log('----- Combined filters: Type + Status + Date -----');
    await E2ELocators.filterDateInput(panel, fp.startDateLabel).fill(start);
    await E2ELocators.filterDateInput(panel, fp.endDateLabel).fill(end);

    const label = `Type "${typeName}" + Status "${statusName}" + Date ${start} to ${end}`;
    const total = await this.#verifyResultsOrMessage(label, ap, fp);
    if (total > 0) {
      await this.#verifyRowsMatchAll(label, [typeName, statusName]);
    }
    expect.soft(total, `${label}: adding a date can only narrow the results (without date: ${typeStatusTotal})`).toBeLessThanOrEqual(typeStatusTotal);
    return total;
  }
   // ---------- NEW: Assessments page stat cards (Total, Assigned, In-Process, Completed) ----------

  // 1. Every card shows its label and a count (any number; the page first shows "..." while loading, so this waits)
  async verifyAssessmentCards(cards, timeout) {
    expect(cards, 'assessmentsPage.cards is missing in E2EData.json').toBeDefined();

    for (const label of Object.values(cards)) {
      await expect(E2ELocators.dashboardCardLabel(this.page, label), `Label "${label}"`).toBeVisible({ timeout });
      await expect(E2ELocators.dashboardCardValue(this.page, label), `Value of "${label}"`).toHaveText(/^\s*\d[\d,]*\s*$/, {
        timeout,
      });
    }
  }

  // 2. Reads the current values, prints them and returns them as numbers
  async getAssessmentCardValues(cards) {
    const read = async (label) => {
      const text = await E2ELocators.dashboardCardValue(this.page, label).innerText();
      return Number(text.replace(/[^\d]/g, ''));
    };

    const values = {
      total: await read(cards.total),
      assigned: await read(cards.assigned),
      inProcess: await read(cards.inProcess),
      completed: await read(cards.completed),
    };

    console.log('----- Assessments card values -----');
    console.log(`${cards.total}: ${values.total}`);
    console.log(`${cards.assigned}: ${values.assigned}`);
    console.log(`${cards.inProcess}: ${values.inProcess}`);
    console.log(`${cards.completed}: ${values.completed}`);
    return values;
  }

  // 3. Assigned + In-Process + Completed must equal Total (the numbers change, so only the present values are used)
  verifyAssessmentCardsSum(cards, values) {
    const sum = values.assigned + values.inProcess + values.completed;
    console.log(
      `Sum: ${cards.assigned} (${values.assigned}) + ${cards.inProcess} (${values.inProcess}) + ` +
      `${cards.completed} (${values.completed}) = ${sum} | ${cards.total}: ${values.total}`
    );
    expect(sum, `${cards.assigned} + ${cards.inProcess} + ${cards.completed} should equal ${cards.total}`).toBe(values.total);
  } 
    // ---------- NEW: Assessments cards must match the Dashboard cards ----------

  // Opens the Dashboard, reads its cards, compares them with the values read on the Assessments page,
  // then returns to the Assessments page so the steps that follow run exactly as before.
  async verifyAssessmentCardsMatchDashboard(ap, dashboardCards, assessmentValues) {
    expect(ap.crossPageMap, 'assessmentsPage.crossPageMap is missing in E2EData.json').toBeDefined();

    // Go to the Dashboard and wait until its cards show real numbers
    await this.dashboardClick.click();
    await this.verifyTabIsActive(this.dashboardClick);
    await this.verifyWelcomeTest();
    await this.verifyDashboardCards(dashboardCards);
    const dashboardValues = await this.getDashboardCardValues(dashboardCards);

    // Compare each Assessments card with its Dashboard card
    console.log('----- Assessments cards vs Dashboard cards -----');
    for (const [assessmentKey, dashboardKey] of Object.entries(ap.crossPageMap)) {
      const assessmentLabel = ap.cards[assessmentKey];
      const dashboardLabel = dashboardCards[dashboardKey];
      const onAssessments = assessmentValues[assessmentKey];
      const onDashboard = dashboardValues[dashboardKey];

      console.log(`${assessmentLabel} (Assessments): ${onAssessments} | ${dashboardLabel} (Dashboard): ${onDashboard}`);
      expect.soft(
        onAssessments,
        `Assessments "${assessmentLabel}" should match Dashboard "${dashboardLabel}"`
      ).toBe(onDashboard);
    }

    // Back to the Assessments page
    await this.assessmentClick.click();
    await this.verifyTabIsActive(this.assessmentClick);
    await this.verifyAssessmentsPageTitle(ap.pageTitle, ap.loadTimeoutMs);
    await this.verifyAssessmentCards(ap.cards, ap.loadTimeoutMs);
  }
    // ---------- NEW: Assessment search ----------

  #searchBox(sb) {
    expect(sb, 'assessmentSearch is missing in E2EData.json').toBeDefined();
    return E2ELocators.searchBox(this.page, sb.boxName);
  }

  // The total of the list as it is now (used as the "before" value for the Clear check)
  async getAssessmentsTotal(ap) {
    return this.#topTotal(ap);
  }

  // 1-6. Search by user name, phone, email, assessment name, upper-case text and a text with no match
  async verifySearchCases(ap, fp, sb) {
    const box = this.#searchBox(sb);
    await box.scrollIntoViewIfNeeded();
    await expect(box, 'Search box').toBeVisible();
    await expect(box, 'Search box').toBeEnabled();

    console.log('----- Search -----');
    const totals = {};
    for (const search of sb.searches) {
      const label = `Search by ${search.label} "${search.term}"`;

      await box.fill(search.term);
      await this.page.waitForTimeout(sb.settleMs);   // the list refreshes shortly after typing

      // results with a bottom total, or the "no assessments" message (rows must contain the text when asked)
      const total = await this.#verifyResultsOrMessage(label, ap, fp, search.matchRows ? search.term : undefined);
      totals[search.label] = total;
      console.log(`${label} -> total count: ${total}`);

      if (search.expectNoResults) {
        expect(total, `${label}: nothing should be found`).toBe(0);
        await expect(E2ELocators.noResultsMessage(this.page, fp.noResultsMessage), `${label}: message`).toBeVisible();
      }
      if (search.sameTotalAs) {
        expect.soft(
          total,
          `${label}: should find the same total as "${search.sameTotalAs}" (search is not case-sensitive)`
        ).toBe(totals[search.sameTotalAs]);
      }
    }
  }

  // 7. Type anything, click "Clear": the box is emptied and the full list comes back
  async verifySearchClear(ap, fp, sb, expectedTotal) {
    const box = this.#searchBox(sb);
    const clear = E2ELocators.searchClear(this.page, sb.clearButton);

    await box.scrollIntoViewIfNeeded();
    await box.fill(sb.clearTerm);
    await expect(clear, `"${sb.clearButton}" button`).toBeVisible();
    await expect(clear, `"${sb.clearButton}" button`).toBeEnabled();
    await clear.click();

    await expect(box, 'Search box after clear').toHaveValue('');
    await expect
      .poll(() => this.#topTotal(ap), {
        message: `Total should return to ${expectedTotal} after "${sb.clearButton}"`,
        timeout: ap.loadTimeoutMs,
      })
      .toBe(expectedTotal);
    await expect.soft(clear, `"${sb.clearButton}" button should be gone once the box is empty`).toBeHidden();

    console.log(`Clear: search box emptied, total back to ${expectedTotal}`);
  }

  // 8. Go to page N, then search by name: results (with a bottom total) or the "no assessments" message
  async verifySearchOnPage3(ap, fp, sb) {
    const box = this.#searchBox(sb);
    const bottom = E2ELocators.bottomCount(this.page, fp.bottomCountPattern).first();
    const pageButton = E2ELocators.paginationButton(this.page, sb.paginationName, sb.paginationPage);

    // start from the full list; work out the page size from "Showing 1 to 10 of N results"
    await box.fill('');
    await this.#settledResults(ap, fp);
    const firstText = (await bottom.innerText()).trim();
    const [start, end] = (firstText.match(/\d[\d,]*/g) || []).map((v) => Number(v.replace(/,/g, '')));
    const pageSize = end - start + 1;
    const expectedStart = (sb.paginationPage - 1) * pageSize + 1;

    console.log('----- Search on a later page -----');
    await pageButton.scrollIntoViewIfNeeded();
    await expect(pageButton, `Page ${sb.paginationPage} button`).toBeVisible();
    await pageButton.click();
    await expect(bottom, `Should be on page ${sb.paginationPage}`).toHaveText(new RegExp(`Showing ${expectedStart} to`));
    console.log(`On page ${sb.paginationPage}: "${(await bottom.innerText()).trim()}"`);

    // now search by name
    await box.fill(sb.pageSearchTerm);
    await this.page.waitForTimeout(sb.settleMs);
    const label = `Search "${sb.pageSearchTerm}" from page ${sb.paginationPage}`;
    const total = await this.#verifyResultsOrMessage(label, ap, fp, sb.pageSearchTerm);
    console.log(`${label} -> total count: ${total}`);

    // leave the page clean for whatever follows
    await box.fill('');
    await this.#settledResults(ap, fp);
  }
      // ---------- NEW: Type + Status + Search + Date, then "Clear Filters" and "Reset Filters" ----------

  // 2-3. Select a type, then a status, then search by name, then add a dates; each step shows results or the message
  async verifyTypeStatusSearchAndDate(ap, fp, sb, fl) {
    expect(fl, 'filterSearchFlow is missing in E2EData.json').toBeDefined();
    const panel = this.#panel(fp);
    const typeSelect = E2ELocators.filterSelect(panel, fp.typeLabel);
    const statusSelect = E2ELocators.filterSelect(panel, fp.statusLabel);
    const box = this.#searchBox(sb);

    const types = (await typeSelect.locator('option').allInnerTexts()).map((v) => v.trim());
    const typeName = types[Math.min(fl.typeIndex, types.length - 1)];
    const statuses = (await statusSelect.locator('option').allInnerTexts()).map((v) => v.trim());
    expect(statuses, `Status list should contain "${fl.status}"`).toContain(fl.status);

    console.log('----- Type + Status + Search + Date -----');

    // 2a. Assessment Type
    await typeSelect.selectOption({ label: typeName });
    await this.#verifyResultsOrMessage(`Type "${typeName}"`, ap, fp, typeName);

    // 2b. Status
    await statusSelect.selectOption({ label: fl.status });
    const statusLabel = `Type "${typeName}" + Status "${fl.status}"`;
    const typeStatusTotal = await this.#verifyResultsOrMessage(statusLabel, ap, fp);
    if (typeStatusTotal > 0) await this.#verifyRowsMatchAll(statusLabel, [typeName, fl.status]);

    // 2c. Search by name
    await box.scrollIntoViewIfNeeded();
    await box.fill(fl.searchTerm);
    await this.page.waitForTimeout(sb.settleMs);
    const searchLabel = `${statusLabel} + Search "${fl.searchTerm}"`;
    const searchTotal = await this.#verifyResultsOrMessage(searchLabel, ap, fp, fl.searchTerm);
    if (searchTotal > 0) await this.#verifyRowsMatchAll(searchLabel, [typeName, fl.status]);
    console.log(`${searchLabel} -> total count: ${searchTotal}`);
    expect.soft(searchTotal, `${searchLabel}: adding a search can only narrow the results (before: ${typeStatusTotal})`).toBeLessThanOrEqual(typeStatusTotal);

    // 3. Dates on top of type + status + search (offsets are days before today; negative = in the future)
    const iso = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const start = iso(fl.startOffsetDays);
    const end = iso(fl.endOffsetDays);
    await E2ELocators.filterDateInput(panel, fp.startDateLabel).fill(start);
    await E2ELocators.filterDateInput(panel, fp.endDateLabel).fill(end);
    const dateLabel = `${searchLabel} + Date ${start} to ${end}`;
    const dateTotal = await this.#verifyResultsOrMessage(dateLabel, ap, fp);
    console.log(`${dateLabel} -> total count: ${dateTotal}`);
    expect.soft(dateTotal, `${dateLabel}: adding dates can only narrow the results (before: ${searchTotal})`).toBeLessThanOrEqual(searchTotal);
  }

  // 4. "Clear Filters" at the top clears the type, status, dates AND the search box
  async clickClearFilters(ap, fp, sb, fl, expectedTotal) {
    const clearAll = E2ELocators.clearAllFilters(this.page, fl.clearAllButton);
    const panel = this.#panel(fp);

    await clearAll.scrollIntoViewIfNeeded();
    await expect(clearAll, `"${fl.clearAllButton}" button`).toBeVisible();
    await expect(clearAll, `"${fl.clearAllButton}" button`).toBeEnabled();
    await clearAll.click();
    await this.#settledResults(ap, fp);

    const typeText = await E2ELocators.filterSelect(panel, fp.typeLabel).evaluate((el) => el.options[el.selectedIndex].text.trim());
    const statusText = await E2ELocators.filterSelect(panel, fp.statusLabel).evaluate((el) => el.options[el.selectedIndex].text.trim());
    expect(typeText, 'Assessment Type after Clear Filters').toBe(fp.defaultType);
    expect(statusText, 'Status after Clear Filters').toBe(fp.defaultStatus);
    await expect(E2ELocators.filterDateInput(panel, fp.startDateLabel), 'Start Date after Clear Filters').toHaveValue('');
    await expect(E2ELocators.filterDateInput(panel, fp.endDateLabel), 'End Date after Clear Filters').toHaveValue('');
    await expect(this.#searchBox(sb), 'Search box after Clear Filters').toHaveValue('');
    await expect
      .poll(() => this.#topTotal(ap), {
        message: `Total should return to ${expectedTotal} after "${fl.clearAllButton}"`,
        timeout: ap.loadTimeoutMs,
      })
      .toBe(expectedTotal);
    await expect.soft(clearAll, `"${fl.clearAllButton}" button should be gone once nothing is filtered`).toBeHidden();

    console.log(`"${fl.clearAllButton}": type, status, dates and search cleared, total back to ${expectedTotal}`);
  }
   // ---------- NEW: assessment table (headers, rows per page, phone format, dates) ----------

  async #tableColumn(tb, name) {
    const headers = (await this.page.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
    const idx = headers.findIndex((t) => t.startsWith(name.toLowerCase()));
    expect(idx, `Column "${name}" should exist in the table header`).toBeGreaterThanOrEqual(0);
    return idx;
  }

  // 1. Column headers
  async verifyTableHeaders(ap, tb) {
    expect(tb, 'assessmentTable is missing in E2EData.json').toBeDefined();
    await expect(E2ELocators.assessmentRows(this.page).first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });
    const headers = (await this.page.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
    expect(headers.length, 'Number of column headers').toBe(tb.headers.length);
    tb.headers.forEach((name, i) => {
      // "Dates" also carries sort buttons (C / U), so match on the start of the header text
      expect.soft(headers[i], `Column ${i + 1} header should be "${name}"`).toMatch(new RegExp(`^${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    });
    console.log(`Table headers: ${headers.join(' | ')}`);
  }

  // 2. Rows per page
  async verifyRowsPerPage(ap, tb) {
    const total = await this.#topTotal(ap);
    const expected = Math.min(tb.rowsPerPage, total);
    await expect(E2ELocators.assessmentRows(this.page), `Rows on page 1 (total ${total})`).toHaveCount(expected);
    console.log(`Rows on page 1: ${expected} (limit ${tb.rowsPerPage}, total ${total})`);
  }

  // 3. Phone format, 4. both dates - checked on every row of the page
  async verifyPhoneAndDates(tb) {
    const rows = E2ELocators.assessmentRows(this.page);
    const count = await rows.count();
    const userIdx = await this.#tableColumn(tb, tb.userColumn);
    const datesIdx = await this.#tableColumn(tb, tb.datesColumn);
    const phoneRe = new RegExp(tb.phonePattern);

    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator('td');
      const userText = (await cells.nth(userIdx).innerText()).replace(/\s+/g, ' ').trim();
      const datesText = (await cells.nth(datesIdx).innerText()).replace(/\s+/g, ' ').trim();

      // phone number
      expect.soft(userText, `Row ${i + 1}: phone number format (${userText})`).toMatch(phoneRe);

      // assigned + expiry dates
      const found = [];
      for (const d of tb.dates) {
        const m = datesText.match(new RegExp(d.pattern));
        expect.soft(m, `Row ${i + 1}: ${d.label} should be displayed (${datesText})`).not.toBeNull();
        found.push(m ? new Date(m[1]) : null);
      }
      if (tb.expiryNotBeforeAssigned && found.length === 2 && found[0] && found[1]) {
        expect.soft(found[1].getTime(), `Row ${i + 1}: ${tb.dates[1].label} should not be before ${tb.dates[0].label}`).toBeGreaterThanOrEqual(found[0].getTime());
      }
    }
    console.log(`Phone format and both dates verified on ${count} rows`);
  }
    // ---------- NEW: default sort order (Latest first) ----------

  // Run on a freshly loaded Assessments page, before any filter, search or sort click
  async verifyDefaultSortOrder(ap, tb) {
    const so = tb.defaultSort;
    expect(so, 'assessmentTable.defaultSort is missing in E2EData.json').toBeDefined();
    const rows = E2ELocators.assessmentRows(this.page);
    await expect(rows.first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });

    const datesIdx = await this.#tableColumn(tb, tb.datesColumn);
    const cfg = tb.dates[so.dateIndex];
    const count = await rows.count();
    const times = [];
    for (let i = 0; i < count; i++) {
      const text = (await rows.nth(i).locator('td').nth(datesIdx).innerText()).replace(/\s+/g, ' ').trim();
      const m = text.match(new RegExp(cfg.pattern));
      expect(m, `Row ${i + 1}: ${cfg.label} should be displayed (${text})`).not.toBeNull();
      times.push(new Date(m[1]).getTime());
    }
    expect(count, 'At least 2 rows are needed to verify the sort order').toBeGreaterThan(1);

    const expected = [...times].sort((a, b) => (so.order === 'desc' ? b - a : a - b));
    const shown = times.map((t) => new Date(t).toDateString());
    expect.soft(times, `Default sort "${so.label}": ${cfg.label} should be ${so.order === 'desc' ? 'newest' : 'oldest'} first. Shown: ${shown.join(', ')}`).toEqual(expected);
    console.log(`Default sort "${so.label}" (${cfg.label}): ${shown.join(' > ')}`);
  } 
    // ---------- NEW: Dates column sort arrows (C / U), ascending and descending ----------

  async #pageDates(tb, dateIndex) {
    const rows = E2ELocators.assessmentRows(this.page);
    const datesIdx = await this.#tableColumn(tb, tb.datesColumn);
    const cfg = tb.dates[dateIndex];
    const count = await rows.count();
    const times = [];
    for (let i = 0; i < count; i++) {
      const text = (await rows.nth(i).locator('td').nth(datesIdx).innerText()).replace(/\s+/g, ' ').trim();
      const m = text.match(new RegExp(cfg.pattern));
      expect(m, `Row ${i + 1}: ${cfg.label} should be displayed (${text})`).not.toBeNull();
      times.push(new Date(m[1]).getTime());
    }
    return times;
  }

  #direction(times) {
    const asc = times.every((t, i) => i === 0 || t >= times[i - 1]);
    const desc = times.every((t, i) => i === 0 || t <= times[i - 1]);
    if (asc && desc) return 'flat';
    return asc ? 'asc' : desc ? 'desc' : 'unsorted';
  }

  async verifyDatesSort(ap, tb) {
    const st = tb.sortToggle;
    expect(st, 'assessmentTable.sortToggle is missing in E2EData.json').toBeDefined();
    const datesTh = this.page.locator('thead th').filter({ hasText: new RegExp(`^\\s*${tb.datesColumn}`, 'i') });
    await expect(E2ELocators.assessmentRows(this.page).first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });

    for (const b of st.buttons) {
      const cfg = tb.dates[b.dateIndex];
      const pattern = new RegExp(st.labelPattern.replace('{label}', b.label));
      const button = datesTh.locator('button, span, div, a').filter({ hasText: pattern }).first();
      await expect(button, `Sort arrow "${b.label}" in the ${tb.datesColumn} header`).toBeVisible();

      const dirs = [];
      for (let n = 1; n <= st.clicks; n++) {
        await button.click();
        await this.page.waitForTimeout(st.settleMs);
        const times = await this.#pageDates(tb, b.dateIndex);
        const dir = this.#direction(times);
        const shown = times.map((t) => new Date(t).toDateString()).join(', ');
        console.log(`Sort ${b.label} (${cfg.label}) click ${n}: ${dir} -> ${shown}`);
        expect.soft(['asc', 'desc'], `Sort ${b.label} click ${n}: ${cfg.label} should be sorted ascending or descending. Shown: ${shown}`).toContain(dir);
        if (n > 1) expect.soft(dir, `Sort ${b.label} click ${n}: the order should flip after clicking again (previous: ${dirs[n - 2]})`).not.toBe(dirs[n - 2]);
        dirs.push(dir);
      }
      expect.soft(new Set(dirs), `Sort ${b.label}: both ascending and descending should work (got ${dirs.join(', ')})`).toEqual(new Set(['asc', 'desc']));
    }
  }
    // ---------- NEW: hover the three dots (row actions) ----------

  // The row action button, or its "already used" twin (ra.alternatives), e.g. "Notify User" / "User Notified"
  #actionButton(row, ra, name) {
    const btn = row.getByRole('button', { name });
    const alt = ra.alternatives && ra.alternatives[name];
    return alt ? btn.or(row.getByRole('button', { name: alt })) : btn;
  }

  async verifyRowActionsOnHover(ap, tb) {
    const ra = tb.rowActions;
    expect(ra, 'assessmentTable.rowActions is missing in E2EData.json').toBeDefined();
    const rows = E2ELocators.assessmentRows(this.page);
    await expect(rows.first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });
    const actionsIdx = await this.#tableColumn(tb, ra.actionsColumn);
    const count = Math.min(ra.rowsToCheck, await rows.count());

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const dots = row.locator('td').nth(actionsIdx).getByRole('button').first();
      const label = `Row ${i + 1}`;

      // before hover the action buttons are not shown
      for (const name of ra.buttons) {
        await expect.soft(this.#actionButton(row, ra, name), `${label}: "${name}" should be hidden before hover`).toBeHidden();
      }

      // hover the three dots
      await dots.scrollIntoViewIfNeeded();
      await dots.hover();
      await this.page.waitForTimeout(ra.settleMs);

      // after hover all the action buttons are shown
      for (const name of ra.buttons) {
        const btn = this.#actionButton(row, ra, name);
        await expect(btn.first(), `${label}: "${name}" should be shown after hovering the three dots`).toBeVisible();
        // a button that has already been used (e.g. "Notify User" -> "User Notified") is shown disabled, which is expected
        const usedAlready = ra.alternatives && ra.alternatives[name] && (await row.getByRole('button', { name }).count()) === 0;
        if (usedAlready) console.log(`${label}: "${name}" is shown as "${ra.alternatives[name]}" (already used)`);
        else await expect.soft(btn.first(), `${label}: "${name}" should be enabled`).toBeEnabled();
      }
      console.log(`${label}: after hover -> ${ra.buttons.join(', ')}`);

      // moving the mouse away hides them again
      await this.page.mouse.move(0, 0);
      await this.page.waitForTimeout(ra.settleMs);
      for (const name of ra.buttons) {
        await expect.soft(this.#actionButton(row, ra, name), `${label}: "${name}" should be hidden after the mouse leaves`).toBeHidden();
      }
    }
  }
    // ---------- NEW: Notes flow (hover three dots -> Notes -> add note -> edit note) ----------

  #pad2(n) {
    return String(n).padStart(2, '0');
  }

  #dayKey(d) {
    return `${d.getFullYear()}-${this.#pad2(d.getMonth() + 1)}-${this.#pad2(d.getDate())}`;
  }

  // Notes page date-time -> Date, whatever the browser locale shows (accepted formats come from the data file)
  #parseStamp(nf, text) {
    for (const f of nf.dateTimeFormats) {
      const m = String(text).trim().match(new RegExp(f.pattern, 'i'));
      if (!m) continue;
      const day = f.order === 'mdy' ? +m[2] : +m[1];
      const month = f.order === 'mdy' ? +m[1] : +m[2];
      let hour = +m[4];
      if (m[7]) hour = (hour % 12) + (m[7].toUpperCase() === 'PM' ? 12 : 0);
      return new Date(+m[3], month - 1, day, hour, +m[5], +m[6]);
    }
    return null;
  }

  // 1-2. Hover the three dots of an "Assigned" row and click Notes
  async hoverAndOpenNotes(ap, tb, nf) {
    expect(nf, 'assessmentNotes is missing in E2EData.json').toBeDefined();
    const rows = E2ELocators.assessmentRows(this.page);
    await expect(rows.first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });

    const userIdx = await this.#tableColumn(tb, tb.userColumn);
    const typeIdx = await this.#tableColumn(tb, nf.typeColumn);
    const statusIdx = await this.#tableColumn(tb, nf.statusColumn);
    const datesIdx = await this.#tableColumn(tb, tb.datesColumn);
    const actionsIdx = await this.#tableColumn(tb, tb.rowActions.actionsColumn);

    const count = await rows.count();
    let chosen = -1;
    let info = {};
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator('td');
      const status = (await cells.nth(statusIdx).innerText()).trim();
      const type = (await cells.nth(typeIdx).innerText()).replace(/\s+/g, ' ').trim();
      if (status.toLowerCase() === nf.status.toLowerCase() && type) {
        const user = (await cells.nth(userIdx).innerText()).split('\n')[0].trim();
        const datesText = (await cells.nth(datesIdx).innerText()).replace(/\s+/g, ' ').trim();
        const assigned = datesText.match(new RegExp(tb.dates[0].pattern));
        const updated = datesText.match(new RegExp(tb.dates[1].pattern));
        info = {
          user,
          type,
          assignedDay: assigned ? this.#dayKey(new Date(assigned[1])) : '',
          updatedDay: updated ? this.#dayKey(new Date(updated[1])) : '',
        };
        chosen = i;
        break;
      }
    }
    expect(chosen, `A row with status "${nf.status}" and an assessment type should be on page 1`).toBeGreaterThanOrEqual(0);
    console.log(`Notes row ${chosen + 1}: ${info.user} | ${info.type} | ${info.assignedDay} | ${info.updatedDay}`);

    const row = rows.nth(chosen);
    await row.locator('td').nth(actionsIdx).getByRole('button').first().hover();
    const notesBtn = row.getByRole('button', { name: nf.notesButton });
    await expect(notesBtn.first(), `"${nf.notesButton}" button after hovering the three dots`).toBeVisible();
    await notesBtn.first().click();
    await expect(E2ELocators.notesPageText(this.page, nf.pageHeading), `"${nf.pageHeading}" page`).toBeVisible({ timeout: ap.loadTimeoutMs });
    return info;
  }

  // 3. Account details on the Notes page
  async verifyNotesAccountDetails(nf, info) {
    const L = nf.detailLabels;
    await expect(this.page.getByText(nf.backLink), `"${nf.backLink}" link`).toBeVisible();
    await expect(E2ELocators.notesPageText(this.page, nf.detailsTitle), `"${nf.detailsTitle}" section`).toBeVisible();
    await expect.soft(this.page.getByText(new RegExp(`^${nf.status}$`, 'i')).first(), `Status badge "${nf.status}"`).toBeVisible();

    const read = async (label) => {
      const row = E2ELocators.noteDetailRow(this.page, label);
      await expect(row, `Detail "${label}" should be displayed`).toBeVisible();
      return (await row.innerText()).replace(label, '').replace(/\s+/g, ' ').trim();
    };
    const user = await read(L.user);
    const assessment = await read(L.assessment);
    const assigned = await read(L.assigned);
    const updated = await read(L.updated);
    console.log(`Notes details -> ${L.user}: ${user} | ${L.assessment}: ${assessment} | ${L.assigned}: ${assigned} | ${L.updated}: ${updated}`);

    expect.soft(user, `${L.user} should match the selected row`).toBe(info.user);
    expect.soft(assessment, `${L.assessment} should match the selected row`).toBe(info.type);
    for (const [label, value, day] of [[L.assigned, assigned, info.assignedDay], [L.updated, updated, info.updatedDay]]) {
      const parsed = this.#parseStamp(nf, value);
      expect.soft(parsed, `${label} "${value}" should match one of the expected date-time formats`).not.toBeNull();
      if (parsed && day) expect.soft(this.#dayKey(parsed), `${label} (${value}) should be on the same day as the row (${day})`).toBe(day);
    }
  }

  #noteMeta(nf, text) {
    // The Created / Updated parts can sit on one line or on several, so flatten the whitespace first
    const flat = String(text).replace(/\s+/g, ' ');
    const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stops = [nf.createdLabel, nf.updatedLabel, nf.editLink].map(esc).join('|');
    // "<label> <date and time> by <name>", where the name ends at the next label, the Edit link or the end
    const grab = (label) => {
      const m = flat.match(new RegExp(`${esc(label)}\\s*(.+?)\\s*by\\s+(.+?)(?=\\s*(?:${stops})(?:\\s|$)|$)`));
      return m ? { at: m[1].trim(), by: m[2].trim() } : null;
    };
    const created = grab(nf.createdLabel);
    const updated = grab(nf.updatedLabel);
    return {
      created: created ? created.at : null,
      createdBy: created ? created.by : null,
      updated: updated ? updated.at : null,
      updatedBy: updated ? updated.by : null,
      text: flat,
    };
  }

  // 4. Add a note
  async addNote(nf) {
    const text = `${nf.noteText} ${Date.now()}`;   // unique, so this run's note is always found
    await expect(E2ELocators.notesPageText(this.page, nf.notesTitle), `"${nf.notesTitle}" section`).toBeVisible();
    await expect(E2ELocators.notesPageText(this.page, nf.addTitle), `"${nf.addTitle}" heading`).toBeVisible();
    const box = E2ELocators.noteTextBox(this.page, nf.notePlaceholder);
    const addBtn = this.page.getByRole('button', { name: nf.addButton, exact: true });
    await box.scrollIntoViewIfNeeded();
    await expect.soft(addBtn, `"${nf.addButton}" should be disabled while the note is empty`).toBeDisabled();
    await box.fill(text);
    await expect(addBtn, `"${nf.addButton}" should be enabled after typing`).toBeEnabled();
    await addBtn.click();

    const card = E2ELocators.noteCard(this.page, text);
    await expect(card, `Note "${text}" should be listed`).toBeVisible();
    await expect(card.getByText(nf.createdLabel), `New note should show "${nf.createdLabel}" once it is saved`).toBeVisible();
    await expect.soft(box, 'Add-note box is cleared after adding').toHaveValue('');

    const meta = this.#noteMeta(nf, await card.innerText());
    expect(meta.created, `New note should show "${nf.createdLabel}" date and time. Card text: "${meta.text}"`).not.toBeNull();
    expect.soft(this.#parseStamp(nf, meta.created), `"${nf.createdLabel}" ${meta.created} should match one of the expected date-time formats`).not.toBeNull();
    expect.soft(meta.createdBy, `New note should show who created it`).toBeTruthy();
    expect.soft(meta.updated, `New note should not show "${nf.updatedLabel}" before editing`).toBeNull();
    console.log(`Note added: "${text}" -> ${nf.createdLabel} ${meta.created} by ${meta.createdBy}`);
    return { text, created: meta.created, createdBy: meta.createdBy };
  }

  // 5-6. Edit the note, save, and verify the created / updated dates and names
  async editNoteAndVerify(nf, added) {
    const card = E2ELocators.noteCard(this.page, added.text);
    await card.getByText(nf.editLink, { exact: true }).click();

    const editBox = this.page.locator('textarea').first();      // the edit box sits above the "Add a new note" box
    await expect(editBox, 'Edit box shows the current note').toHaveValue(added.text);
    const saveBtn = this.page.getByRole('button', { name: nf.saveButton, exact: true });
    await expect.soft(this.page.getByRole('button', { name: nf.cancelButton, exact: true }), `"${nf.cancelButton}" button`).toBeVisible();
    await expect(saveBtn, `"${nf.saveButton}" button`).toBeVisible();

    const newText = `${nf.editedText} ${added.text.split(' ').pop()}`;
    await editBox.fill(newText);
    await saveBtn.click();

    const edited = E2ELocators.noteCard(this.page, newText);
    await expect(edited, `Edited note "${newText}" should be listed`).toBeVisible();
    // the card matches while the button still says "Saving..."; wait until the saved note shows its Updated line
    await expect(edited.getByText(nf.updatedLabel), `Edited note should show "${nf.updatedLabel}" once it is saved`).toBeVisible();
    await expect.soft(E2ELocators.noteCard(this.page, added.text), 'Old note text is gone').toHaveCount(0);

    const meta = this.#noteMeta(nf, await edited.innerText());
    expect.soft(meta.created, `${nf.createdLabel} date should not change after the edit`).toBe(added.created);
    expect.soft(meta.createdBy, `"${nf.createdLabel}" by-name`).toBeTruthy();
    expect.soft(meta.updatedBy, `"${nf.updatedLabel}" by-name`).toBeTruthy();
    if (nf.byName) {
      expect.soft((meta.createdBy || '').toLowerCase(), `${nf.createdLabel} by-name`).toBe(nf.byName.toLowerCase());
      expect.soft((meta.updatedBy || '').toLowerCase(), `${nf.updatedLabel} by-name`).toBe(nf.byName.toLowerCase());
    }
    const createdAt = this.#parseStamp(nf, meta.created);
    const updatedAt = this.#parseStamp(nf, meta.updated);
    expect.soft(updatedAt, `${nf.updatedLabel} "${meta.updated}" should match one of the expected date-time formats`).not.toBeNull();
    if (createdAt && updatedAt) expect.soft(updatedAt.getTime(), `${nf.updatedLabel} should not be before ${nf.createdLabel}`).toBeGreaterThanOrEqual(createdAt.getTime());
    console.log(`Note edited: "${newText}" -> ${nf.createdLabel} ${meta.created} by ${meta.createdBy} | ${nf.updatedLabel} ${meta.updated} by ${meta.updatedBy}`);
  }

  // back to the Assessments list
  async backToAssessments(ap, nf) {
    await this.page.getByText(nf.backLink).click();
    await this.verifyAssessmentsPageTitle(ap.pageTitle, ap.loadTimeoutMs);
  }

  // ---------- NEW: Notify User (enabled -> success pop-up, disabled -> "send next reminder tomorrow" message) ----------

  // Move the mouse away first so the row is collapsed, then hover its three dots
  async #hoverRowActions(row, actionsIdx, settleMs) {
    await this.page.mouse.move(0, 0);
    await this.page.waitForTimeout(settleMs);
    const dots = row.locator('td').nth(actionsIdx).getByRole('button').first();
    await dots.scrollIntoViewIfNeeded();
    await dots.hover();
    await this.page.waitForTimeout(settleMs);
  }

  // Hovers the three dots and waits for the given action button. The hover is repeated when the page was still busy
  // (e.g. a pop-up was just closed or the table was refreshing), so the buttons do not appear on the first attempt.
  async #revealAction(row, actionsIdx, btn, settleMs, label, name) {
    const dots = row.locator('td').nth(actionsIdx).getByRole('button').first();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.#hoverRowActions(row, actionsIdx, settleMs);
      if (await btn.first().isVisible()) return;
      // a slower, step-by-step mouse move so the page sees the pointer entering the row
      const box = await dots.boundingBox();
      if (box) {
        await this.page.mouse.move(box.x - 40, box.y + box.height / 2);
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      }
      await this.page.waitForTimeout(settleMs);
      if (await btn.first().isVisible()) return;
    }
    await expect(btn.first(), `${label}: "${name}" after hovering the three dots`).toBeVisible();
  }

  // Disabled "User Notified" button: hovering it explains when the next reminder can be sent
  async #verifyNotifiedTooltip(label, disabledBtn, nu) {
    await expect(disabledBtn.first(), `${label}: "${nu.disabledName}" should be disabled`).toBeDisabled();
    await disabledBtn.first().hover({ force: true });
    await expect(this.page.getByText(nu.disabledTooltip, { exact: true }).first(), `${label}: message "${nu.disabledTooltip}" should be shown`).toBeVisible();
  }

  async verifyNotifyUser(ap, tb, nu) {
    expect(nu, 'notifyUser is missing in E2EData.json').toBeDefined();
    const rows = E2ELocators.assessmentRows(this.page);
    await expect(rows.first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });
    const statusIdx = await this.#tableColumn(tb, nu.statusColumn);
    const actionsIdx = await this.#tableColumn(tb, tb.rowActions.actionsColumn);

    // the first rows on this page that have the wanted status
    const wanted = [];
    const count = await rows.count();
    for (let i = 0; i < count && wanted.length < nu.rowsToCheck; i++) {
      const status = (await rows.nth(i).locator('td').nth(statusIdx).innerText()).trim();
      if (status.toLowerCase() === nu.status.toLowerCase()) wanted.push(i);
    }
    expect(wanted.length, `Rows with status "${nu.status}" on page 1`).toBeGreaterThan(0);

    let sent = 0;
    let alreadyNotified = 0;
    for (const i of wanted) {
      const row = rows.nth(i);
      const label = `Row ${i + 1}`;
      const enabledBtn = row.getByRole('button', { name: nu.enabledName });
      const disabledBtn = row.getByRole('button', { name: nu.disabledName });

      // 1. hover the three dots
      await this.#hoverRowActions(row, actionsIdx, nu.settleMs);
      await expect(enabledBtn.or(disabledBtn).first(), `${label}: a notify button should be shown after hovering the three dots`).toBeVisible();

      if ((await enabledBtn.count()) > 0) {
        // 2. enabled: click it and the success pop-up is displayed
        await expect(enabledBtn.first(), `${label}: "${nu.enabledName}" should be enabled`).toBeEnabled();
        await enabledBtn.first().click();
        await expect(this.page.getByText(nu.successTitle, { exact: true }).first(), `${label}: "${nu.successTitle}" pop-up`).toBeVisible({ timeout: nu.toastTimeoutMs });
        await expect(this.page.getByText(nu.successMessage).first(), `${label}: pop-up message "${nu.successMessage}"`).toBeVisible({ timeout: nu.toastTimeoutMs });
        console.log(`${label}: "${nu.enabledName}" clicked -> ${nu.successTitle}: ${nu.successMessage}`);
        sent++;

        // afterwards the button is disabled and explains the next reminder is tomorrow
        await this.#hoverRowActions(row, actionsIdx, nu.settleMs);
        await expect(disabledBtn.first(), `${label}: button should read "${nu.disabledName}" after the notification is sent`).toBeVisible();
        await this.#verifyNotifiedTooltip(label, disabledBtn, nu);
      } else {
        // 3. disabled: the message says the next reminder can be sent tomorrow
        await this.#verifyNotifiedTooltip(label, disabledBtn, nu);
        console.log(`${label}: "${nu.disabledName}" is disabled -> "${nu.disabledTooltip}"`);
        alreadyNotified++;
      }
    }
    console.log(`Notify User: ${sent} notification(s) sent, ${alreadyNotified} already notified, ${wanted.length} row(s) checked`);
  }

  // ---------- NEW: Show Key flow (hover three dots -> Show Key -> expired / active pop-up) ----------

  #escRe(v) {
    return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // The "User Authentication Key" pop-up (the smallest block holding both its title and its Close button)
  #keyDialog(sk) {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText(sk.dialogTitle, { exact: true }) })
      .filter({ has: this.page.getByRole('button', { name: sk.closeButton, exact: true }) })
      .last();
  }

  // Reads the key and the "Expires: / Expired:" date and time shown in the pop-up
  async #readKey(dialog, sk) {
    const text = (await dialog.innerText()).replace(/\s+/g, ' ');
    const m = text.match(new RegExp(sk.keyPattern));
    return { key: m ? m[1] : null, kind: m ? m[2] : null, at: m ? m[3] : null, text };
  }

  async #verifyKeyShown(label, dialog, sk, expectExpired) {
    const info = await this.#readKey(dialog, sk);
    expect(info.key, `${label}: the key should be displayed. Pop-up text: "${info.text}"`).not.toBeNull();
    expect(info.at, `${label}: the key's date and time should be displayed. Pop-up text: "${info.text}"`).not.toBeNull();
    const when = new Date(info.at.replace(/\s+/g, ' '));
    expect.soft(Number.isNaN(when.getTime()), `${label}: "${info.at}" should be a valid date`).toBe(false);
    if (!Number.isNaN(when.getTime())) {
      const inPast = when.getTime() < Date.now();
      expect.soft(inPast, `${label}: the date ${info.at} should be in the ${expectExpired ? 'past (expired)' : 'future (active)'}`).toBe(expectExpired);
    }
    console.log(`${label}: key = ${info.key} | ${info.kind}: ${info.at}`);
    return info;
  }

  async #openShowKey(ap, tb, sk, rowIndex, actionsIdx, label) {
    const rows = E2ELocators.assessmentRows(this.page);
    const row = rows.nth(rowIndex);
    const showBtn = row.getByRole('button', { name: sk.buttonName });
    await this.#revealAction(row, actionsIdx, showBtn, sk.settleMs, label, sk.buttonName);
    await showBtn.first().click();
    const dialog = this.#keyDialog(sk);
    await expect(dialog, `${label}: "${sk.dialogTitle}" pop-up`).toBeVisible({ timeout: ap.loadTimeoutMs });
    return dialog;
  }

  // Regenerate Key -> "Are you sure?" -> Yes, Regenerate -> success message -> new key shown
  async #regenerateKey(label, dialog, sk, oldKey) {
    await dialog.getByRole('button', { name: sk.regenerateButton, exact: true }).click();
    await expect(dialog.getByRole('button', { name: sk.confirmButton }), `${label}: "${sk.confirmButton}" button`).toBeVisible();
    await dialog.getByRole('button', { name: sk.confirmButton }).click();
    await expect(this.page.getByText(sk.regeneratedMessage).first(), `${label}: success message "${sk.regeneratedMessage}"`).toBeVisible({ timeout: sk.toastTimeoutMs });
    await expect.poll(async () => (await this.#readKey(dialog, sk)).key, { message: `${label}: a new key should replace "${oldKey}"`, timeout: sk.toastTimeoutMs }).not.toBe(oldKey);
  }

  async #closeKeyDialog(label, dialog, sk) {
    await dialog.getByRole('button', { name: sk.closeButton, exact: true }).last().click();
    await expect(this.page.getByText(sk.dialogTitle, { exact: true }), `${label}: pop-up should close`).toBeHidden();
  }

  async verifyShowKey(ap, tb, sk) {
    expect(sk, 'showKey is missing in E2EData.json').toBeDefined();
    const rows = E2ELocators.assessmentRows(this.page);
    await expect(rows.first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });
    const statusIdx = await this.#tableColumn(tb, sk.statusColumn);
    const actionsIdx = await this.#tableColumn(tb, tb.rowActions.actionsColumn);

    // 1. a row with the "Assigned" status
    const count = await rows.count();
    let chosen = -1;
    for (let i = 0; i < count; i++) {
      const status = (await rows.nth(i).locator('td').nth(statusIdx).innerText()).trim();
      if (status.toLowerCase() === sk.status.toLowerCase()) { chosen = i; break; }
    }
    expect(chosen, `A row with status "${sk.status}" should be on page 1`).toBeGreaterThanOrEqual(0);

    // 2. hover the three dots and click Show Key
    let dialog = await this.#openShowKey(ap, tb, sk, chosen, actionsIdx, `Show Key row ${chosen + 1}`);

    // 3. either the expired pop-up or the active pop-up is displayed
    const expiredMsg = dialog.getByText(sk.expiredMessage);
    const infoMsg = dialog.getByText(new RegExp(this.#escRe(sk.infoMessage).replace(/:\s/, ':\\s*')));
    await expect(expiredMsg.or(infoMsg).first(), 'Either the expired or the active key pop-up should be displayed').toBeVisible();

    if ((await expiredMsg.count()) > 0) {
      // 4. expired: generate a new key, confirm, close
      const old = await this.#verifyKeyShown('Expired key', dialog, sk, true);
      expect(old.text, 'The expired pop-up should be marked as expired').toMatch(new RegExp(sk.expiredTag, 'i'));
      await this.#regenerateKey('Expired key', dialog, sk, old.key);
      await this.#verifyKeyShown('Expired key, regenerated', dialog, sk, false);
      await this.#closeKeyDialog('Expired key', dialog, sk);

      // open Show Key again: the key is active now, so the rest of the flow can run
      dialog = await this.#openShowKey(ap, tb, sk, chosen, actionsIdx, `Show Key row ${chosen + 1} (again)`);
      await expect(dialog.getByText(new RegExp(this.#escRe(sk.infoMessage).replace(/:\s/, ':\\s*'))).first(), 'Active key pop-up').toBeVisible();
    }

    // 5. active pop-up: info text, key and expiry date
    await expect(dialog.getByText(new RegExp(this.#escRe(sk.infoMessage).replace(/:\s/, ':\\s*'))).first(), `Info text "${sk.infoMessage}"`).toBeVisible();
    const first = await this.#verifyKeyShown('Active key', dialog, sk, false);

    // 6. copy to clipboard -> success message
    await dialog.getByRole('button', { name: sk.copyButton }).click();
    await expect(this.page.getByText(sk.copiedMessage).first(), `Message "${sk.copiedMessage}"`).toBeVisible({ timeout: sk.toastTimeoutMs });

    // 7-9. Regenerate Key -> confirmation text with Yes / Cancel -> Cancel
    const regen = dialog.getByRole('button', { name: sk.regenerateButton, exact: true });
    await regen.click();
    await expect(dialog.getByText(sk.confirmMessage), `Confirmation "${sk.confirmMessage}"`).toBeVisible();
    await expect(dialog.getByRole('button', { name: sk.confirmButton }), `"${sk.confirmButton}" button`).toBeVisible();
    await expect(dialog.getByRole('button', { name: sk.cancelButton }), `"${sk.cancelButton}" button`).toBeVisible();
    await dialog.getByRole('button', { name: sk.cancelButton }).click();
    await expect(dialog.getByText(sk.confirmMessage), 'Confirmation should close after Cancel').toBeHidden();
    expect.soft((await this.#readKey(dialog, sk)).key, 'Cancel should keep the same key').toBe(first.key);

    // 10-11. Regenerate Key again -> Yes, Regenerate -> success message and the new key
    await this.#regenerateKey('Active key', dialog, sk, first.key);
    const second = await this.#verifyKeyShown('Active key, regenerated', dialog, sk, false);
    console.log(`Key changed: ${first.key} -> ${second.key}`);

    // 12. close
    await this.#closeKeyDialog('Active key', dialog, sk);
  }

  // ---------- NEW: View History flow (hover three dots -> View History -> Assessment History page -> Back) ----------

  async verifyViewHistory(ap, tb, vh) {
    expect(vh, 'viewHistory is missing in E2EData.json').toBeDefined();
    const rows = E2ELocators.assessmentRows(this.page);
    await expect(rows.first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });
    const userIdx = await this.#tableColumn(tb, tb.userColumn);
    const statusIdx = await this.#tableColumn(tb, vh.statusColumn);
    const actionsIdx = await this.#tableColumn(tb, tb.rowActions.actionsColumn);
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. a row with the "Assigned" status
    const count = await rows.count();
    let chosen = -1;
    let user = '';
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator('td');
      const status = (await cells.nth(statusIdx).innerText()).trim();
      if (status.toLowerCase() === vh.status.toLowerCase()) {
        user = (await cells.nth(userIdx).innerText()).split('\n')[0].trim();
        chosen = i;
        break;
      }
    }
    expect(chosen, `A row with status "${vh.status}" should be on page 1`).toBeGreaterThanOrEqual(0);
    console.log(`View History row ${chosen + 1}: ${user}`);

    // 2. hover the three dots and click View History
    const row = rows.nth(chosen);
    const historyBtn = row.getByRole('button', { name: vh.buttonName });
    await this.#revealAction(row, actionsIdx, historyBtn, vh.settleMs, `View History row ${chosen + 1}`, vh.buttonName);
    await historyBtn.first().click();

    // 3. the history page opens
    const heading = this.page.getByText(new RegExp(`${esc(user)}\\s*[—–-]\\s*${esc(vh.headingSuffix)}`)).first();
    await expect(heading, `"${user} — ${vh.headingSuffix}" page should open`).toBeVisible({ timeout: ap.loadTimeoutMs });

    // 4. "<n> assessments across <m> types"
    const summary = this.page.getByText(new RegExp(vh.summaryPattern)).first();
    await expect(summary, `Summary line like "${vh.summaryExample}"`).toBeVisible();
    const m = (await summary.innerText()).replace(/\s+/g, ' ').match(new RegExp(vh.summaryPattern));
    const assessments = Number(m[1]);
    const types = Number(m[2]);
    expect(assessments, 'Number of assessments in the summary').toBeGreaterThan(0);
    expect(types, 'Number of types in the summary').toBeGreaterThan(0);
    expect(assessments, 'Assessments should not be fewer than types').toBeGreaterThanOrEqual(types);
    console.log(`History summary: ${assessments} assessment(s) across ${types} type(s)`);

    // the type tabs carry a count each; they should add up to the summary
    const tabTexts = (await this.page.getByRole('button').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter((t) => new RegExp(vh.typeTabPattern).test(t));
    if (tabTexts.length > 0) {
      const sum = tabTexts.reduce((s, t) => s + Number(t.match(new RegExp(vh.typeTabPattern))[1]), 0);
      expect.soft(tabTexts.length, `Type tabs (${tabTexts.join(' | ')}) should match the number of types`).toBe(types);
      expect.soft(sum, `Type tab counts (${tabTexts.join(' | ')}) should add up to the number of assessments`).toBe(assessments);
    }

    // 5. Sessions table with Date, Status, Score, Report
    await expect(this.page.getByText(new RegExp(`^\\s*${esc(vh.sessionsTitle)}\\b`)).first(), `"${vh.sessionsTitle}" section`).toBeVisible();
    for (const name of vh.sessionHeaders) {
      const re = new RegExp(`^\\s*${esc(name)}\\s*$`, 'i');
      const header = this.page.getByRole('columnheader', { name: re }).or(this.page.getByText(re)).first();
      await expect.soft(header, `Sessions table header "${name}"`).toBeVisible();
    }
    console.log(`Sessions table headers: ${vh.sessionHeaders.join(', ')}`);

    // 6. Back goes to the assessments list
    const back = this.page.getByRole('button', { name: vh.backButton }).or(this.page.getByRole('link', { name: vh.backButton })).first();
    await back.click();
    await expect(heading, 'History page should close after Back').toBeHidden({ timeout: ap.loadTimeoutMs });
    await expect(E2ELocators.assessmentRows(this.page).first(), 'Assessments list after Back').toBeVisible({ timeout: ap.loadTimeoutMs });
  }

  // ---------- NEW: Ivory Report flow (find a Completed row on any page -> three dots -> Ivory Report -> back) ----------

  // Goes to the next page of the table; returns false when it is already the last page
  async #nextTablePage(fp, ir) {
    const bottom = E2ELocators.bottomCount(this.page, fp.bottomCountPattern).first();
    const nums = ((await bottom.innerText()).match(/\d[\d,]*/g) || []).map((v) => Number(v.replace(/,/g, '')));
    const [start, end, total] = nums;
    if (end >= total) return false;

    // only the table's pagination bar ("Next →" button); the top menu is a different navigation (it holds "Logout")
    const nav = this.page.getByRole('navigation', { name: ir.paginationName, exact: true });
    const next = nav.getByRole('button', { name: ir.nextButton });
    if (!(await next.isEnabled())) return false;
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await expect(bottom, `Should move on from rows starting at ${start}`).not.toHaveText(new RegExp(`Showing ${start} to`), { timeout: ir.pageChangeTimeoutMs });
    await expect(E2ELocators.assessmentRows(this.page).first(), 'Rows of the next page').toBeVisible({ timeout: ir.pageChangeTimeoutMs });
    return true;
  }

  async verifyIvoryReport(ap, fp, tb, ir) {
    expect(ir, 'ivoryReport is missing in E2EData.json').toBeDefined();
    const rows = E2ELocators.assessmentRows(this.page);

    // 1. go to the Assessments page (page 1)
    await this.page.getByRole('link', { name: ir.navTab, exact: true }).click();
    await expect(E2ELocators.assessmentsPageTitle(this.page, ap.pageTitle), `"${ap.pageTitle}" page`).toBeVisible({ timeout: ap.loadTimeoutMs });
    await expect(rows.first(), 'First table row').toBeVisible({ timeout: ap.loadTimeoutMs });

    const userIdx = await this.#tableColumn(tb, tb.userColumn);
    const typeIdx = await this.#tableColumn(tb, ir.typeColumn);
    const statusIdx = await this.#tableColumn(tb, ir.statusColumn);
    const actionsIdx = await this.#tableColumn(tb, tb.rowActions.actionsColumn);

    // 2-3. look for a Completed row, page by page
    let found = null;
    let pageNo = 1;
    for (;;) {
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const cells = rows.nth(i).locator('td');
        const status = (await cells.nth(statusIdx).innerText()).trim();
        if (status.toLowerCase() === ir.status.toLowerCase()) {
          found = {
            index: i,
            user: (await cells.nth(userIdx).innerText()).split('\n')[0].trim(),
            type: (await cells.nth(typeIdx).innerText()).replace(/\s+/g, ' ').trim(),
          };
          break;
        }
      }
      if (found) break;
      console.log(`Page ${pageNo}: no "${ir.status}" assessment`);
      if (!(await this.#nextTablePage(fp, ir))) break;
      pageNo++;
    }
    expect(found, `A "${ir.status}" assessment should exist on one of the ${pageNo} page(s) checked`).not.toBeNull();

    // 4. the user and the assessment name
    console.log(`"${ir.status}" assessment found on page ${pageNo}, row ${found.index + 1}: user "${found.user}", assessment "${found.type || '(no assessment name shown)'}"`);

    // 5-6. hover the three dots and click Ivory Report
    const row = rows.nth(found.index);
    const reportBtn = row.getByRole('button', { name: ir.buttonName });
    await this.#revealAction(row, actionsIdx, reportBtn, ir.settleMs, `Ivory Report row ${found.index + 1}`, ir.buttonName);
    await expect(reportBtn.first(), `"${ir.buttonName}" should be enabled`).toBeEnabled();

    const popupPromise = this.page.context().waitForEvent('page', { timeout: ir.reportOpenTimeoutMs }).catch(() => null);
    const urlBefore = this.page.url();
    await reportBtn.first().click();

    // 7. the report page opens (normally in a new tab)
    const popup = await popupPromise;
    const reportPage = popup || this.page;
    if (!popup) {
      await expect.poll(() => this.page.url(), { message: 'The report should open in a new tab or in this tab', timeout: ir.reportOpenTimeoutMs }).not.toBe(urlBefore);
    }
    await expect.poll(() => reportPage.url(), { message: `Report address should match ${ir.reportUrlPattern}`, timeout: ir.reportOpenTimeoutMs }).toMatch(new RegExp(ir.reportUrlPattern, 'i'));
    console.log(`Report opened (${popup ? 'new tab' : 'same tab'}): ${reportPage.url().split('?')[0]}`);

    // 8. come back to the assessments page
    if (popup) {
      await popup.close();
      await this.page.bringToFront();
    } else {
      await this.page.goBack();
    }
    await expect(E2ELocators.assessmentsPageTitle(this.page, ap.pageTitle), 'Back on the Assessments page').toBeVisible({ timeout: ap.loadTimeoutMs });
    await expect(rows.first(), 'Assessments table after coming back').toBeVisible({ timeout: ap.loadTimeoutMs });
  }

  // ---------- NEW: Pagination (footer text, total pages, page 2, Next and Previous) ----------

  #parseFooter(text) {
    const n = (text.match(/\d[\d,]*/g) || []).map((v) => Number(v.replace(/,/g, '')));
    return { start: n[0], end: n[1], total: n[2] };
  }

  // The footer must read "Showing <start> to <end> of <total> results" for the given page
  async #expectPage(label, bottom, pageNo, pageSize, total, timeout) {
    const start = (pageNo - 1) * pageSize + 1;
    const end = Math.min(pageNo * pageSize, total);
    const thousands = String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ',?');
    await expect(bottom, `${label}: footer should read "Showing ${start} to ${end} of ${total} results"`)
      .toHaveText(new RegExp(`Showing\\s+${start}\\s+to\\s+${end}\\s+of\\s+${thousands}\\s+results`), { timeout });
    await expect(E2ELocators.assessmentRows(this.page).first(), `${label}: rows`).toBeVisible({ timeout });
    console.log(`${label}: "${(await bottom.innerText()).trim()}"`);
  }

  async verifyPagination(ap, fp, tb, pg) {
    expect(pg, 'pagination is missing in E2EData.json').toBeDefined();
    const timeout = ap.loadTimeoutMs;
    const rows = E2ELocators.assessmentRows(this.page);
    const bottom = E2ELocators.bottomCount(this.page, fp.bottomCountPattern).first();
    const nav = this.page.getByRole('navigation', { name: pg.paginationName, exact: true });
    const prev = nav.getByRole('button', { name: pg.previousButton });
    const next = nav.getByRole('button', { name: pg.nextButton });

    // start from page 1 of the full list
    await this.page.getByRole('link', { name: pg.navTab, exact: true }).click();
    await expect(E2ELocators.assessmentsPageTitle(this.page, ap.pageTitle), `"${ap.pageTitle}" page`).toBeVisible({ timeout });
    await expect(rows.first(), 'First table row').toBeVisible({ timeout });
    await bottom.scrollIntoViewIfNeeded();

    // The page keeps its position when the Assessments tab is clicked again (e.g. after the Ivory Report step left it on
    // page 2), so go to page 1 explicitly before checking the first page.
    if (this.#parseFooter(await bottom.innerText()).start !== 1) {
      await E2ELocators.paginationButton(this.page, pg.paginationName, 1).click();
      await expect(bottom, 'Should be back on page 1').toHaveText(/Showing\s+1\s+to/, { timeout });
    }

    // 1. "Showing <n> to <n> of <n> results"
    await expect(bottom, 'Footer text "Showing <n> to <n> of <n> results"').toBeVisible({ timeout });
    const { start, end, total } = this.#parseFooter(await bottom.innerText());
    const pageSize = end - start + 1;
    expect(start, 'Footer should start at result 1 on the first page').toBe(1);
    expect(pageSize, 'Results per page in the footer').toBe(tb.rowsPerPage);
    expect(total, 'Total results in the footer should be more than one page').toBeGreaterThan(pageSize);
    const top = (await E2ELocators.assessmentsCount(this.page, ap.countPattern).innerText()).match(/\d[\d,]*/g).map((v) => Number(v.replace(/,/g, '')));
    expect.soft(total, `Footer total should match the top count "${top.join(' ')}"`).toBe(top[2]);
    console.log(`Footer: Showing ${start} to ${end} of ${total} results`);

    // 2. total pages: the last numbered button equals ceil(total / page size)
    const totalPages = Math.ceil(total / pageSize);
    const numbers = (await nav.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter((t) => /^\d+$/.test(t)).map(Number);
    expect(Math.max(...numbers), `Last page number should be ${totalPages} (${total} results / ${pageSize} per page)`).toBe(totalPages);
    console.log(`Total pages: ${totalPages}`);

    // on the first page Previous is disabled and Next is enabled
    await expect(prev, `"${pg.previousButton}" is disabled on page 1`).toBeDisabled();
    await expect(next, `"${pg.nextButton}" is enabled on page 1`).toBeEnabled();
    const firstRowPage1 = (await rows.first().innerText()).replace(/\s+/g, ' ');

    // 3. click page 2
    await E2ELocators.paginationButton(this.page, pg.paginationName, pg.jumpPage).click();
    await this.#expectPage(`Page ${pg.jumpPage}`, bottom, pg.jumpPage, pageSize, total, timeout);
    await expect(prev, `"${pg.previousButton}" is enabled on page ${pg.jumpPage}`).toBeEnabled();
    expect.soft((await rows.first().innerText()).replace(/\s+/g, ' '), 'Page 2 should show different rows from page 1').not.toBe(firstRowPage1);

    // 4. Next -> the page after, then Previous -> back
    await next.click();
    await this.#expectPage(`Next (page ${pg.jumpPage + 1})`, bottom, pg.jumpPage + 1, pageSize, total, timeout);
    await prev.click();
    await this.#expectPage(`Previous (page ${pg.jumpPage})`, bottom, pg.jumpPage, pageSize, total, timeout);

    // Previous again returns to page 1, where Previous is disabled
    await prev.click();
    await this.#expectPage('Previous (page 1)', bottom, 1, pageSize, total, timeout);
    await expect(prev, `"${pg.previousButton}" is disabled again on page 1`).toBeDisabled();
  }
//---------------------------------------------
//user
//---------------------------------------------------

  async verifyUsersPageTitle(title, timeout) {
    expect(title, 'users.pageTitle is missing in E2EData.json').toBeTruthy();
    const heading = E2ELocators.usersPageTitle(this.page, title);
    await expect(heading, `Page title "${title}"`).toBeVisible({ timeout });
    await expect(heading, `Page title "${title}"`).toHaveText(title);
    console.log(`Page title shown: "${(await heading.innerText()).trim()}"`);
  }

  // The Users tab is active and looks different from each of the other tabs
  async verifyUsersTabHighlighted() {
    await this.verifyTabIsActive(this.userClick);
    for (const other of [this.dashboardClick, this.assessmentClick, this.productClick]) {
      await this.verifyTabIsNotActive(other);
      await this.verifyTabIsHighlighted(this.userClick, other);
    }
    console.log('Users tab is highlighted; the other tabs are not');
  }
    // Users page stat cards: each shows its label and a value in the expected format; the values are printed
  async verifyUserCards(cards, timeout) {
    expect(cards, 'users.cards is missing in E2EData.json').toBeDefined();
    console.log('----- Users card values -----');
    const values = {};

    for (const c of cards) {
      await expect(E2ELocators.usersCardLabel(this.page, c.label), `Label "${c.label}"`).toBeVisible({ timeout });

      // the card only matches when its text is exactly "<label> <value>", so this also checks the value format
      const card = E2ELocators.usersCard(this.page, c.label, c.pattern);
      await expect(card, `Card "${c.label}" should show a value matching ${c.pattern}`).toBeVisible({ timeout });

      const text = (await card.innerText()).replace(/\s+/g, ' ').trim();
      values[c.label] = text.replace(c.label, '').trim();
      console.log(`${c.label}: ${values[c.label]}`);
    }
    return values;
  }
    // Users page table: column headers, rows per page, and the "Showing .. of .. users" counts (the numbers are printed)
  async verifyUserTable(ut, timeout) {
    expect(ut, 'users.table is missing in E2EData.json').toBeDefined();
    const numbers = (text) => (text.match(/\d[\d,]*/g) || []).map((v) => Number(v.replace(/,/g, '')));

    // 4. column headers (the page shows them in capitals, so they are compared ignoring case; a sort arrow after a name is ignored)
    const headerCells = E2ELocators.usersHeaders(this.page);
    await expect(headerCells.first(), 'Table headers').toBeVisible({ timeout });
    const shown = (await headerCells.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    expect(shown.length, `Table should have ${ut.headers.length} columns, found: ${shown.join(' | ')}`).toBe(ut.headers.length);
    ut.headers.forEach((name, i) => {
      expect.soft(shown[i].toLowerCase().startsWith(name.toLowerCase()), `Column ${i + 1} should be "${name}" (found "${shown[i]}")`).toBe(true);
    });
    console.log(`Users table headers: ${shown.join(' | ')}`);

    // 2. rows per page, and every row has a name
    const rows = E2ELocators.usersRows(this.page);
    await expect(rows.first(), 'First table row').toBeVisible({ timeout });
    const rowCount = await rows.count();
    expect(rowCount, `Rows on the page (limit ${ut.rowsPerPage})`).toBe(ut.rowsPerPage);
    for (let i = 0; i < rowCount; i++) {
      const name = (await rows.nth(i).locator('td').first().innerText()).replace(/\s+/g, ' ').trim();
      expect.soft(name, `Row ${i + 1} should show a name`).not.toBe('');
    }
    console.log(`Rows on the page: ${rowCount}`);

    // 3. "Showing <n> - <n> of <n> users" under "User Management", and "Showing <n> to <n> of <n> users" below the table
    const topCount = E2ELocators.usersCount(this.page, ut.topCountPattern);
    await expect(topCount, `Count text like "Showing 1 - 10 of 50 users"`).toBeVisible({ timeout });
    const [topStart, topEnd, topTotal] = numbers(await topCount.innerText());
    console.log(`User Management count: "${(await topCount.innerText()).trim()}" -> Showing ${topStart} - ${topEnd} of ${topTotal} users`);
    expect(topStart, 'Count should start at 1 on the first page').toBe(1);
    expect(topEnd - topStart + 1, 'Count range should equal the rows shown').toBe(rowCount);
    expect(topTotal, 'Total users should not be less than the rows shown').toBeGreaterThanOrEqual(topEnd);

    const bottomCount = E2ELocators.usersCount(this.page, ut.bottomCountPattern);
    await bottomCount.scrollIntoViewIfNeeded();
    await expect(bottomCount, `Footer text like "Showing 1 to 10 of 50 users"`).toBeVisible({ timeout });
    const [botStart, botEnd, botTotal] = numbers(await bottomCount.innerText());
    console.log(`Footer count: "${(await bottomCount.innerText()).trim()}" -> Showing ${botStart} to ${botEnd} of ${botTotal} users`);
    expect.soft([botStart, botEnd, botTotal], 'Footer numbers should match the numbers under "User Management"').toEqual([topStart, topEnd, topTotal]);
  }
  async verifyUserAssessmentCounts(ac, timeout) {
  expect(ac?.columnHeader, 'users.table.assessmentCounts is missing in E2EData.json').toBeTruthy();
  const headers = (await E2ELocators.usersHeaders(this.page).allInnerTexts()).map(t => t.trim().toLowerCase());
  const colIndex = headers.findIndex(h => h.startsWith(ac.columnHeader.toLowerCase()));
  expect(colIndex, `Column "${ac.columnHeader}" not found`).toBeGreaterThanOrEqual(0);

  const rows = E2ELocators.usersRows(this.page);
  await expect(rows.first(), 'Users table rows').toBeVisible({ timeout });
  const checkCount = Math.min(ac.rowsToCheck, await rows.count());
  expect(checkCount, 'Rows available to check').toBeGreaterThan(0);

  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const read = (text, label) => {
    const m = text.match(new RegExp(`(\\d+)\\s*${escape(label)}`, 'i'));
    return m ? Number(m[1]) : null;
  };

  for (let i = 0; i < checkCount; i++) {
    const row = rows.nth(i);
    const name = (await row.locator('td').first().innerText()).trim().split('\n').pop().trim();
    const text = await E2ELocators.usersRowCell(row, colIndex).innerText();
    const v = {};
    for (const [key, label] of Object.entries(ac.labels)) {
      v[key] = read(text, label);
      expect(v[key], `Row ${i + 1} (${name}): "${label}" count is missing in "${text.replace(/\s+/g, ' ')}"`).not.toBeNull();
    }
    const sum = v.assigned + v.inProgress + v.completed;
    expect(v.total, `Row ${i + 1} (${name}): ${ac.labels.total} ${v.total} should equal ${sum}`).toBe(sum);
    console.log(`Row ${i + 1} ${name}: ${ac.labels.total}=${v.total}, ${ac.labels.assigned}=${v.assigned}, ${ac.labels.inProgress}=${v.inProgress}, ${ac.labels.completed}=${v.completed} -> ${v.total} = ${sum}`);
  }
}
async verifyUserSorting(sort, timeout) {
  expect(sort?.columns?.length, 'users.table.sort is missing in E2EData.json').toBeGreaterThan(0);
  const headers = E2ELocators.usersHeaders(this.page);
  const rows = E2ELocators.usersRows(this.page);
  await expect(rows.first(), 'Users table rows').toBeVisible({ timeout });
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

  const arrowOf = async (index) => {
    const text = await headers.nth(index).innerText();
    if (sort.ascArrows.some(a => text.includes(a))) return 'asc';
    if (sort.descArrows.some(a => text.includes(a))) return 'desc';
    return 'none';
  };

  const texts = (await headers.allInnerTexts()).map(t => t.trim().toLowerCase());
  const indexOf = {};
  for (const col of sort.columns) {
    const i = texts.findIndex(t => t.startsWith(col.header.toLowerCase()));
    expect(i, `Column "${col.header}" not found`).toBeGreaterThanOrEqual(0);
    indexOf[col.header] = i;
  }

  const parse = (col, cellText) => {
    const lines = cellText.split('\n').map(l => l.trim()).filter(Boolean);
  if (col.type === 'text') {
  if (col.pattern) {
    const hit = cellText.match(new RegExp(col.pattern));
    return hit ? hit[0] : '';
  }
  const line = col.line === 'last' ? lines[lines.length - 1] : lines[0];
  expect(line, `${col.header}: empty cell`).toBeTruthy();
  return line;
}
    const m = cellText.match(new RegExp(col.pattern));
    expect(m, `${col.header}: value not found in "${cellText.replace(/\s+/g, ' ')}"`).not.toBeNull();
    if (col.type === 'date') {
      const p = {};
      col.dateOrder.split('').forEach((k, i) => { p[k] = Number(m[i + 1]); });
      return Date.UTC(p.y, p.m - 1, p.d);
    }
    return Number(m[1]);
  };
  const compare = (col, a, b) => {
  if (col.type !== 'text') return a - b;
  if (col.caseSensitive) return a < b ? -1 : a > b ? 1 : 0;
  return collator.compare(a, b);
};
  for (const col of sort.columns) {
    const index = indexOf[col.header];
    const states = [];
    for (let click = 1; click <= sort.clicks; click++) {
      const before = await arrowOf(index);
      await headers.nth(index).click();
      await expect.poll(() => arrowOf(index), { timeout, message: `${col.header}: sort arrow did not change after click ${click}` }).not.toBe(before);
      await this.page.waitForTimeout(sort.settleMs);
      const state = await arrowOf(index);
      expect(state, `${col.header}: no sort arrow shown`).not.toBe('none');

      for (const other of sort.columns) {
        if (other.header === col.header) continue;
        expect(await arrowOf(indexOf[other.header]), `"${other.header}" should show no arrow while "${col.header}" is sorted`).toBe('none');
      }

      const count = await rows.count();
      const values = [];
      for (let i = 0; i < count; i++) {
        values.push(parse(col, await E2ELocators.usersRowCell(rows.nth(i), index).innerText()));
      }
      for (let i = 1; i < values.length; i++) {
        const c = compare(col, values[i - 1], values[i]);
        const ok = state === 'asc' ? c <= 0 : c >= 0;
        expect(ok, `${col.header} (${state}): row ${i} "${values[i - 1]}" and row ${i + 1} "${values[i]}" are out of order`).toBe(true);
      }
      const note = new Set(values).size === 1 ? ' (all values equal, order cannot be proven on this page)' : '';
      console.log(`${col.header} sorted ${state}: ${values.join(' | ')}${note}`);
      states.push(state);
    }
    expect(new Set(states).size, `${col.header}: the arrow did not toggle between clicks`).toBe(states.length);
  }
}

  // ---------- Users page: row actions (three dots) and the Edit User pop-up ----------
  async #usersActionsIndex(ra) {
    const texts = (await E2ELocators.usersHeaders(this.page).allInnerTexts()).map((t) => t.trim().toLowerCase());
    const i = texts.findIndex((t) => t.startsWith(ra.actionsColumn.toLowerCase()));
    expect(i, `Column "${ra.actionsColumn}" not found`).toBeGreaterThanOrEqual(0);
    return i;
  }

  // Hovers the three dots of one user row until the action buttons are shown; returns the row and the user name
  async #usersHoverActions(rowIndex, ra, timeout) {
    const rows = E2ELocators.usersRows(this.page);
    await expect(rows.first(), 'Users table rows').toBeVisible({ timeout });
    expect(await rows.count(), `Users table should have a row ${rowIndex + 1}`).toBeGreaterThan(rowIndex);
    const actionsIdx = await this.#usersActionsIndex(ra);
    const row = rows.nth(rowIndex);
    const name = (await row.locator('td').first().innerText()).trim().split('\n').pop().trim();
    const dots = E2ELocators.usersRowCell(row, actionsIdx).getByRole('button').first();
    const firstAction = E2ELocators.userRowAction(row, ra.buttons[0]);

    for (let attempt = 1; attempt <= 3; attempt++) {
      await dots.scrollIntoViewIfNeeded();
      await dots.hover();
      await this.page.waitForTimeout(ra.settleMs);
      if (await firstAction.isVisible()) break;
      // a slower, step-by-step mouse move so the page sees the pointer entering the row
      const box = await dots.boundingBox();
      if (box) {
        await this.page.mouse.move(box.x - 40, box.y + box.height / 2);
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      }
      await this.page.waitForTimeout(ra.settleMs);
      if (await firstAction.isVisible()) break;
    }
    return { row, name };
  }

  // 1. Hover the three dots of a user: all the action buttons are shown (and hidden again when the mouse moves away)
  async verifyUserRowActions(ra, timeout) {
    expect(ra?.buttons?.length, 'users.rowActions is missing in E2EData.json').toBeGreaterThan(0);
    await this.page.mouse.move(0, 0);
    await this.page.waitForTimeout(ra.settleMs);
    const beforeRow = E2ELocators.usersRows(this.page).nth(ra.hoverRow);
    for (const label of ra.buttons) {
      await expect.soft(E2ELocators.userRowAction(beforeRow, label), `"${label}" should be hidden before hovering the three dots`).toBeHidden();
    }

    const { row, name } = await this.#usersHoverActions(ra.hoverRow, ra, timeout);
    for (const label of ra.buttons) {
      const btn = E2ELocators.userRowAction(row, label);
      await expect(btn, `${name}: "${label}" should be shown after hovering the three dots`).toBeVisible();
      await expect.soft(btn, `${name}: "${label}" should be enabled`).toBeEnabled();
    }
    console.log(`User "${name}": after hover -> ${ra.buttons.join(', ')}`);

    await this.page.mouse.move(0, 0);
    await this.page.waitForTimeout(ra.settleMs);
  }

  // 2-4. Edit User: open it from the hover menu and close it with the Cancel button; then again on another user, closing it with the X icon
  async verifyEditUser(ra, timeout) {
    const ed = ra?.editDialog;
    expect(ed, 'users.rowActions.editDialog is missing in E2EData.json').toBeDefined();
    const scenarios = [
      { how: `"${ed.cancelButton}" button`, rowIndex: ra.cancelRow, closer: (dialog) => E2ELocators.editUserCancel(dialog, ed.cancelButton) },
      { how: 'close icon', rowIndex: ra.closeRow, closer: (dialog) => E2ELocators.editUserClose(dialog, ed.closeButton) },
    ];

    for (const sc of scenarios) {
      await this.page.mouse.move(0, 0);
      const { row, name } = await this.#usersHoverActions(sc.rowIndex, ra, timeout);
      await E2ELocators.userRowAction(row, ra.editButton).click();

      const dialog = E2ELocators.editUserDialog(this.page, ed.title, ed.cancelButton);
      await expect(dialog, `"${ed.title}" pop-up for "${name}"`).toBeVisible({ timeout });
      for (const label of ed.infoLabels) {
        await expect.soft(dialog.getByText(label).first(), `Pop-up should show "${label}"`).toBeVisible();
      }
      await expect.soft(dialog.getByText(name).first(), `Pop-up should show the user "${name}"`).toBeVisible();
      await expect.soft(dialog.getByRole('button', { name: ed.saveButton, exact: true }), `"${ed.saveButton}" button`).toBeVisible();
      console.log(`"${ed.title}" pop-up opened for "${name}"`);

      await sc.closer(dialog).click();
      await expect(dialog, `"${ed.title}" pop-up should close with the ${sc.how}`).toBeHidden({ timeout });
      await expect(E2ELocators.usersRows(this.page).first(), 'Users table after closing the pop-up').toBeVisible({ timeout });
      console.log(`"${ed.title}" pop-up closed with the ${sc.how}`);
    }
  }

  // Users page: hover the three dots of a user -> "View Assessments" -> the Assessments page (with that user's results) -> "Back to Users"
  async verifyUserViewAssessments(users, ap, timeout) {
    const va = users?.viewAssessments;
    expect(va, 'users.viewAssessments is missing in E2EData.json').toBeDefined();

    // 1. hover the three dots of a user and click "View Assessments"
    const { row, name } = await this.#usersHoverActions(va.row, users.rowActions, timeout);
    await E2ELocators.userRowAction(row, va.button).click();

    // 2. the Assessments page opens
    await this.verifyAssessmentsPageTitle(ap.pageTitle, ap.loadTimeoutMs);
    await expect(E2ELocators.backToUsers(this.page, va.backLink), `"${va.backLink}" link`).toBeVisible({ timeout });
    await expect(E2ELocators.assessmentsLoading(this.page, ap.loadingText), 'Assessments should finish loading').toBeHidden({ timeout });

    // 3. the result table with the "Showing <n> - <n> of <n> assessments" statement (the numbers can be anything; they are printed)
    await expect(E2ELocators.assessmentsHeading(this.page, ap.heading), `"${ap.heading}"`).toBeVisible({ timeout });
    const countText = E2ELocators.assessmentsCount(this.page, ap.countPattern);
    await expect(countText, `Statement like "Showing 1 - 1 of 1 assessments"`).toBeVisible({ timeout });
    const [start, end, total] = ((await countText.innerText()).match(/\d[\d,]*/g) || []).map((v) => Number(v.replace(/,/g, '')));
    console.log(`"${name}" assessments: "${(await countText.innerText()).trim()}" -> Showing ${start} - ${end} of ${total} assessments`);
    expect(end, 'Range end should not be less than its start').toBeGreaterThanOrEqual(start);
    expect(total, 'Total should not be less than the range end').toBeGreaterThanOrEqual(end);

    const rows = E2ELocators.assessmentRows(this.page);
    await expect(rows.first(), 'Assessment results table').toBeVisible({ timeout });
    expect(await rows.count(), 'Rows in the table should match the Showing statement').toBe(end - start + 1);
    for (let i = 0; i < (await rows.count()); i++) {
      await expect.soft(rows.nth(i), `Row ${i + 1} should belong to "${name}"`).toContainText(name);
    }

    // 4. the total / assigned / in-process / completed cards
    await this.verifyAssessmentCards(ap.cards, ap.loadTimeoutMs);
    const cardValues = await this.getAssessmentCardValues(ap.cards);
    this.verifyAssessmentCardsSum(ap.cards, cardValues);
    console.log(`Assessment cards: ${JSON.stringify(cardValues)}`);

    // 5. "Back to Users" returns to the Users page
    await E2ELocators.backToUsers(this.page, va.backLink).click();
    await this.verifyUsersPageTitle(users.pageTitle, users.loadTimeoutMs);
    await this.verifyUsersTabHighlighted();
    await expect(E2ELocators.usersRows(this.page).first(), 'Users table after going back').toBeVisible({ timeout });
    console.log(`"${va.backLink}" returned to the Users page`);
  }

  // Users page: hover the three dots of a user -> "View History" -> "<user> — Assessment History" page -> Back to the Users page
  async verifyUserViewHistory(users, vh, timeout) {
    const uh = users?.viewHistory;
    expect(uh, 'users.viewHistory is missing in E2EData.json').toBeDefined();
    expect(vh, 'viewHistory is missing in E2EData.json').toBeDefined();
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. hover the three dots of a user and click "View History"
    const { row, name } = await this.#usersHoverActions(uh.row, users.rowActions, timeout);
    await E2ELocators.userRowAction(row, uh.button).click();

    // 2. the "<user> — Assessment History" page opens, with the "<n> assessments across <m> types" line
    const heading = this.page.getByText(new RegExp(`${esc(name)}\\s*[—–-]\\s*${esc(vh.headingSuffix)}`)).first();
    await expect(heading, `"${name} — ${vh.headingSuffix}" page should open`).toBeVisible({ timeout });
    const summary = this.page.getByText(new RegExp(vh.summaryPattern)).first();
    await expect(summary, `Summary line like "${vh.summaryExample}"`).toBeVisible({ timeout });
    const m = (await summary.innerText()).replace(/\s+/g, ' ').match(new RegExp(vh.summaryPattern));
    console.log(`"${name}" history: ${Number(m[1])} assessment(s) across ${Number(m[2])} type(s)`);

    // 3. the Sessions table with Date, Status, Score and Report, and its data
    await expect(this.page.getByText(new RegExp(`^\\s*${esc(vh.sessionsTitle)}\\b`)).first(), `"${vh.sessionsTitle}" section`).toBeVisible({ timeout });
    for (const header of vh.sessionHeaders) {
      const re = new RegExp(`^\\s*${esc(header)}\\s*$`, 'i');
      await expect.soft(this.page.getByRole('columnheader', { name: re }).or(this.page.getByText(re)).first(), `Sessions table header "${header}"`).toBeVisible();
    }
    console.log(`Sessions table headers: ${vh.sessionHeaders.join(', ')}`);

    const sessionRows = this.page.locator('tbody tr').or(this.page.getByRole('row').filter({ hasNot: this.page.getByRole('columnheader') }));
    await expect(sessionRows.first(), 'Sessions table should show data').toBeVisible({ timeout });
    const rowCount = await sessionRows.count();
    for (let i = 0; i < rowCount; i++) {
      const cells = sessionRows.nth(i).getByRole('cell');
      const values = (await cells.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      expect.soft(values.length, `Session ${i + 1} should have ${vh.sessionHeaders.length} columns (${values.join(' | ')})`).toBe(vh.sessionHeaders.length);
      values.forEach((v, c) => expect.soft(v, `Session ${i + 1}: "${vh.sessionHeaders[c]}" should not be empty`).not.toBe(''));
      expect.soft(values[0], `Session ${i + 1}: "${vh.sessionHeaders[0]}" should look like a date`).toMatch(new RegExp(uh.datePattern));
      console.log(`Session ${i + 1}: ${vh.sessionHeaders.map((h, c) => `${h}=${values[c]}`).join(', ')}`);
    }

    // 4. the Back link returns to the Users page
    const back = this.page.getByRole('button', { name: vh.backButton }).or(this.page.getByRole('link', { name: vh.backButton })).first();
    await back.click();
    await expect(heading, 'History page should close after Back').toBeHidden({ timeout });
    await this.verifyUsersPageTitle(users.pageTitle, users.loadTimeoutMs);
    await this.verifyUsersTabHighlighted();
    await expect(E2ELocators.usersRows(this.page).first(), 'Users table after going back').toBeVisible({ timeout });
    console.log(`"${vh.backButton}" returned to the Users page`);
  }

  // Users page: hover the three dots of a user -> "View Notes" -> pop-up -> Add Note + Cancel -> Add Note + Save -> Show more / Show less -> created date -> close icon
  async verifyUserViewNotes(users, assessmentNotes, timeout) {
    const vn = users?.viewNotes;
    expect(vn, 'users.viewNotes is missing in E2EData.json').toBeDefined();
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const settle = () => this.page.waitForTimeout(vn.settleMs);

    // 1. hover the three dots of a user and click "View Notes"
    const { row, name } = await this.#usersHoverActions(vn.row, users.rowActions, timeout);
    await E2ELocators.userRowAction(row, vn.button).click();

    // 2. the notes pop-up is displayed
    const title = `${vn.titlePrefix} ${name}`;
    await expect(this.page.getByText(title, { exact: true }).first(), `"${title}" pop-up`).toBeVisible({ timeout });
    const addNote = this.page.getByRole('button', { name: vn.addButton, exact: true });
    await expect(addNote, `"${vn.addButton}" button`).toBeVisible({ timeout });
    console.log(`"${title}" pop-up displayed`);

    // 3. Add Note -> the note form -> Cancel
    const box = this.page.getByPlaceholder(vn.placeholder);
    const cancel = this.page.getByRole('button', { name: vn.cancelButton, exact: true });
    const save = this.page.getByRole('button', { name: vn.saveButton, exact: true });
    await addNote.click();
    await expect(box, 'Note box').toBeVisible({ timeout });
    await expect(cancel, `"${vn.cancelButton}" button`).toBeVisible();
    await expect(save, `"${vn.saveButton}" button`).toBeVisible();
    await cancel.click();
    await expect(box, `Note box should close after "${vn.cancelButton}"`).toBeHidden({ timeout });
    await expect(addNote, `"${vn.addButton}" button after Cancel`).toBeVisible({ timeout });
    console.log(`"${vn.cancelButton}" closed the note box`);

    // 4. Add Note again -> type a note -> Save Note (one more note is listed)
    const created = this.page.getByText(new RegExp(`^\\s*${esc(vn.createdLabel)}`));
    const before = await created.count();
    await addNote.click();
    await expect(box, 'Note box').toBeVisible({ timeout });
    await box.fill(vn.noteText);
    await save.click();
    await expect(box, `Note box should close after "${vn.saveButton}"`).toBeHidden({ timeout });
    await expect(this.page.getByText(vn.listTitle, { exact: true }).first(), `"${vn.listTitle}" section`).toBeVisible({ timeout });
    await expect.poll(async () => created.count(), { timeout, message: 'One more note should be listed after saving' }).toBe(before + 1);
    await settle();
    console.log(`Note "${vn.noteText}" saved`);

    // 5. Show more / Show less on the note
    const card = E2ELocators.userNoteCard(this.page, vn.noteText, vn.createdLabel);
    const showMore = card.getByText(vn.showMore, { exact: true });
    const showLess = card.getByText(vn.showLess, { exact: true });
    await expect(showMore, `"${vn.showMore}" option`).toBeVisible({ timeout });
    await showMore.click();
    await expect(showLess, `"${vn.showLess}" option after "${vn.showMore}"`).toBeVisible({ timeout });
    await showLess.click();
    await expect(showMore, `"${vn.showMore}" option after "${vn.showLess}"`).toBeVisible({ timeout });
    console.log(`"${vn.showMore}" and "${vn.showLess}" work`);

    // 6. the created date is shown (the date can be anything, but it must be a real date and time)
    const cardText = (await card.innerText()).replace(/\s+/g, ' ');
    const createdMatch = cardText.match(new RegExp(vn.createdPattern));
    expect(createdMatch, `The note should show "${vn.createdLabel} <date and time>" (found "${cardText}")`).not.toBeNull();
    const formats = assessmentNotes?.dateTimeFormats || [];
    if (formats.length) {
      expect.soft(formats.some((f) => new RegExp(f.pattern).test(createdMatch[1].trim())), `Created date "${createdMatch[1]}" should match one of: ${formats.map((f) => f.name).join(', ')}`).toBe(true);
    }
    console.log(`${vn.createdLabel} ${createdMatch[1]}`);

    // 7. the close icon closes the pop-up
    await E2ELocators.userNotesClose(this.page, title).click();
    await expect(this.page.getByText(title, { exact: true }), `"${title}" pop-up should close`).toHaveCount(0, { timeout });
    await expect(E2ELocators.usersRows(this.page).first(), 'Users table after closing the pop-up').toBeVisible({ timeout });
    console.log(`"${title}" pop-up closed with the close icon`);

  }
  //new
    async verifyUserShowKey(users, showKey, timeout = 15000) {
    const sk = users.showKey;
    const { row } = await this.#usersHoverActions(sk.row, users.rowActions, timeout);
    await E2ELocators.userRowAction(row, sk.button).click();

    // Pop-up opens
    const dialog = E2ELocators.userKeyDialog(this.page, showKey.dialogTitle, showKey.closeButton);
    await expect(dialog, `"${showKey.dialogTitle}" pop-up should open`).toBeVisible({ timeout });

    // Key + expiry (the pop-up shows a spinner first, so poll until the key loads)
    const keyRe = new RegExp(showKey.keyPattern);
    await expect.poll(async () => keyRe.test(await dialog.innerText()), {
      message: 'Authentication key and expiry should load', timeout,
    }).toBe(true);
    const m = (await dialog.innerText()).match(keyRe);
    console.log(`Show Key pop-up: key=${m[1]}, ${m[2]}: ${m[3]}`);

    // Content of the pop-up
    await expect.soft(dialog.getByText(showKey.infoMessage.replace(/^Info:\s*/, ''), { exact: false })).toBeVisible();
    await expect.soft(dialog.getByRole('button', { name: showKey.copyButton })).toBeVisible();
    await expect.soft(dialog.getByRole('button', { name: showKey.regenerateButton })).toBeVisible();
    await expect.soft(dialog.getByRole('button', { name: showKey.closeButton, exact: true })).toBeVisible();

    // Click the cancel (X) icon
    await E2ELocators.userKeyCancelIcon(dialog, sk.iconLabel).click();
    await expect(dialog, 'Pop-up should close after clicking the X icon').toBeHidden({ timeout });
    await this.page.waitForTimeout(sk.settleMs);
    await expect(E2ELocators.usersRows(this.page).first(), 'Should stay on the Users page').toBeVisible({ timeout });
  }
    async verifyUserPagination(users, timeout = 15000) {
    const pg = users.pagination;
    const rowsPerPage = users.table.rowsPerPage;
    const nav = E2ELocators.usersPagination(this.page, pg.paginationName);
    const next = E2ELocators.usersPageButton(nav, pg.nextButton, false);
    const prev = E2ELocators.usersPageButton(nav, pg.previousButton, false);
    await nav.scrollIntoViewIfNeeded();
    await expect(nav, 'Pagination should be visible').toBeVisible({ timeout });

    const readRange = async () => {
      const text = await E2ELocators.usersCount(this.page, users.table.bottomCountPattern).innerText();
      const m = text.match(/(\d+)\s+to\s+(\d+)\s+of\s+(\d+)/);
      return m ? { from: +m[1], to: +m[2], total: +m[3], text: text.trim() } : null;
    };
    const firstRow = async () => (await E2ELocators.usersRows(this.page).first().innerText()).replace(/\s+/g, ' ').trim();

    // Checks that the footer shows the range of the page and that the table holds that many rows
    const expectPage = async (p, label) => {
      const { total } = await readRange();
      const from = (p - 1) * rowsPerPage + 1;
      const to = Math.min(p * rowsPerPage, total);
      await expect.poll(async () => (await readRange())?.text, {
        message: `${label}: footer should show users ${from} to ${to} of ${total}`, timeout,
      }).toMatch(new RegExp(`Showing\\s+${from}\\s+to\\s+${to}\\s+of\\s+${total}`));
      await expect(E2ELocators.usersRows(this.page), `${label}: rows on page ${p}`).toHaveCount(to - from + 1, { timeout });
      const key = await firstRow();
      console.log(`${label}: page ${p} -> "${(await readRange()).text}"`);
      return key;
    };

    // Start state: page 1, "Previous" is disabled
    const page1Key = await expectPage(1, 'Start');
    await expect(prev, `"${pg.previousButton}" should be disabled on page 1`).toBeDisabled();

    // 1. Next -> page 2
    await next.click();
    const page2Key = await expectPage(2, `"${pg.nextButton}"`);
    expect(page2Key, 'Page 2 should show different users than page 1').not.toBe(page1Key);
    await expect(prev, `"${pg.previousButton}" should be enabled on page 2`).toBeEnabled();

    // 2. Previous -> back to page 1
    await prev.click();
    const backKey = await expectPage(1, `"${pg.previousButton}"`);
    expect(backKey, 'Going back should show the same users as page 1 before').toBe(page1Key);

    // 3. Click a page number
    const { total } = await readRange();
    const lastPage = Math.ceil(total / rowsPerPage);
    expect(pg.jumpPage, `users.pagination.jumpPage must be between 1 and ${lastPage}`).toBeLessThanOrEqual(lastPage);
    await E2ELocators.usersPageButton(nav, String(pg.jumpPage), true).click();
    const jumpKey = await expectPage(pg.jumpPage, `Page ${pg.jumpPage}`);
    expect(jumpKey, `Page ${pg.jumpPage} should show different users than page 1`).not.toBe(page1Key);
    await this.page.waitForTimeout(pg.settleMs);
  }
//===============================================
//product
//===================================================
   // =====================================================
  // Products
  // =====================================================
  async verifyProductsPage(products, timeout = 15000) {
    // page title
    await expect(E2ELocators.productsPageTitle(this.page, products.pageTitle), `Page title "${products.pageTitle}"`).toBeVisible({ timeout });
    console.log(`Page title shown: "${products.pageTitle}"`);

    // "<number> assessments available · <number> active" (the numbers can be anything)
    const re = new RegExp(products.countPattern);
    const countText = E2ELocators.productsCount(this.page, products.countPattern);
    await expect(countText, 'Products count statement should be shown').toBeVisible({ timeout });
    const m = (await countText.innerText()).replace(/\s+/g, ' ').match(re);
    expect(m, 'Count statement should match "<n> assessments available · <n> active"').not.toBeNull();
    const available = Number(m[1]);
    const active = Number(m[2]);
    expect(Number.isInteger(available) && Number.isInteger(active), 'Both counts should be numbers').toBe(true);
    expect.soft(active, 'Active count cannot be more than the available count').toBeLessThanOrEqual(available);
    console.log(`Products count: "${m[0]}" -> available=${available}, active=${active}`);
  }

  async verifyProductsCardsAndDetails(products, timeout = 15000) {
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. "All", "Active", "Available" tabs show a count
    const counts = {};
    for (const label of products.tabs) {
      const tab = E2ELocators.productTab(this.page, esc(label), products.tabCountPattern);
      await expect(tab, `"${label}" tab with its count`).toBeVisible({ timeout });
      counts[label] = Number((await tab.innerText()).match(/\d+/)[0]);
    }
    console.log(`Product tabs: ${products.tabs.map((t) => `${t} ${counts[t]}`).join(' | ')}`);
    const [allL, activeL, availL] = products.tabs;
    expect.soft(counts[allL], `"${allL}" should equal "${activeL}" + "${availL}"`).toBe(counts[activeL] + counts[availL]);
    const header = (await E2ELocators.productsCount(this.page, products.countPattern).innerText()).replace(/\s+/g, ' ').match(new RegExp(products.countPattern));
    expect.soft(counts[allL], 'All tab should equal the "assessments available" number').toBe(Number(header[1]));
    expect.soft(counts[activeL], 'Active tab should equal the "active" number').toBe(Number(header[2]));

    // 2. every assessment card shows its name (each card is a button "View details for <name>")
    const cards = E2ELocators.productCards(this.page, products.cardAction);
    await expect.poll(() => cards.count(), { message: `All ${counts[allL]} assessment cards should load`, timeout }).toBe(counts[allL]);
    const names = [];
    const activeIdx = [];
    for (let i = 0; i < counts[allL]; i++) {
      const card = cards.nth(i);
      const name = (await E2ELocators.productCardName(card).innerText()).trim();
      expect.soft(name, `Card ${i + 1} should show a name`).toBeTruthy();
      names.push(name);
      if ((await E2ELocators.productCardBadge(card, products.activeBadge).count()) > 0) activeIdx.push(i);
    }
    expect.soft(new Set(names).size, 'Card names should be unique').toBe(names.length);
    expect.soft(activeIdx.length, `Cards with the "${products.activeBadge}" badge should equal the "${activeL}" count`).toBe(counts[activeL]);
    console.log(`----- ${names.length} assessment cards -----\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`);

    // 3. "View details" on an active card -> detail pop-up
    const dt = products.detail;
    expect(activeIdx.length, 'There should be at least one active card').toBeGreaterThan(dt.row);
    const idx = activeIdx[dt.row];
    const name = names[idx];
    await cards.nth(idx).getByText(products.cardAction, { exact: true }).click();
    const dialog = E2ELocators.productDialog(this.page, name, [dt.activeLine]);
    await expect(dialog, `Detail pop-up for "${name}"`).toBeVisible({ timeout });
    console.log(`Detail pop-up opened for "${name}"`);

    // assessment name, time duration, Overview, Components, Detailed Description, Cognitive Areas
    // Each detail may or may not be present: it is checked when shown and reported either way
    const present = [];
    const absent = [];
    const check = async (label, locator) => ((await locator.count()) > 0 ? present : absent).push(label);
    await check(dt.nameLabel, dialog.getByText(name, { exact: true }));
    await check(dt.durationLabel, dialog.getByText(new RegExp(dt.durationPattern)));
    for (const label of dt.labels) await check(label, E2ELocators.productDialogLabel(dialog, label));
    if (present.includes(dt.durationLabel)) {
      console.log(`${dt.durationLabel}: ${(await dialog.getByText(new RegExp(dt.durationPattern)).first().innerText()).trim()}`);
    }
    // the Cognitive Areas table is checked only when that section is shown
    if (present.includes(dt.labels[dt.labels.length - 1])) {
      for (const h of dt.cognitiveHeaders) {
        await expect.soft(dialog.getByText(h, { exact: true }).first(), `Cognitive Areas column "${h}"`).toBeVisible();
      }
    }
    console.log(`Pop-up details shown: ${present.join(', ') || 'none'}`);
    console.log(`Pop-up details not shown (allowed): ${absent.join(', ') || 'none'}`);

    // 4. "Active for your account" is shown for an active card
    const activeLine = dialog.getByText(dt.activeLine, { exact: true });
    await activeLine.scrollIntoViewIfNeeded();
    await expect(activeLine, `"${dt.activeLine}" line`).toBeVisible({ timeout });
    console.log(`"${dt.activeLine}" is shown for the active card "${name}"`);

    // 5. click the close (X) icon -> the pop-up closes
    await E2ELocators.productDialogClose(dialog, dt.closeIcon).click();
    await expect(dialog, `Detail pop-up for "${name}" should close after clicking the X icon`).toBeHidden({ timeout });
    await expect(cards.nth(idx), 'Products page should be shown again after closing the pop-up').toBeVisible({ timeout });
    console.log(`Detail pop-up for "${name}" closed with the X icon`);
  }
   async verifyProductsTabFilters(products, timeout = 15000) {
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [allL, activeL, availL] = products.tabs;
    const cards = E2ELocators.productCards(this.page, products.cardAction);
    const tabOf = (label) => E2ELocators.productTab(this.page, esc(label), products.tabCountPattern);
    const countOf = async (label) => Number((await tabOf(label).innerText()).match(/\d+/)[0]);

    // reads every card on screen: name, status badge, "View details" link, "Contact Sales" button
    const readCards = async () => {
      const list = [];
      const n = await cards.count();
      for (let i = 0; i < n; i++) {
        const card = cards.nth(i);
        list.push({
          name: (await E2ELocators.productCardName(card).innerText()).trim(),
          active: (await E2ELocators.productCardBadge(card, products.activeBadge).count()) > 0,
          inactive: (await E2ELocators.productCardBadge(card, products.inactiveBadge).count()) > 0,
          details: (await card.getByText(products.cardAction, { exact: true }).count()) > 0,
          contact: (await E2ELocators.productContactSales(card, products.contactSales).count()) > 0,
        });
      }
      return list;
    };
    const openTab = async (label) => {
      const expected = await countOf(label);
      await tabOf(label).click();
      await expect(tabOf(label), `"${label}" tab should be selected`).toHaveAttribute('aria-selected', 'true', { timeout });
      await expect.poll(() => cards.count(), { message: `"${label}" tab should list ${expected} assessments`, timeout }).toBe(expected);
      return readCards();
    };
    const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

    // baseline: the "All" tab
    const all = await openTab(allL);
    const activeNames = all.filter((c) => c.active).map((c) => c.name);
    const inactiveNames = all.filter((c) => !c.active).map((c) => c.name);

    // 1. "Active" tab: all the active assessment names
    const active = await openTab(activeL);
    expect.soft(active.every((c) => c.active), `Every card on the "${activeL}" tab should show the "${products.activeBadge}" badge`).toBe(true);
    expect.soft(active.some((c) => c.contact), `No card on the "${activeL}" tab should show "${products.contactSales}"`).toBe(false);
    expect.soft(sameSet(active.map((c) => c.name), activeNames), `"${activeL}" tab should list exactly the active assessments of the "${allL}" tab`).toBe(true);
    console.log(`"${activeL}" tab (${active.length}):\n${active.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}`);

    // 2. "Available" tab: all the available (not active) assessment names, each with "Contact Sales"
    const avail = await openTab(availL);
    expect.soft(avail.some((c) => c.active), `No card on the "${availL}" tab should show the "${products.activeBadge}" badge`).toBe(false);
    expect.soft(avail.every((c) => c.contact), `Every card on the "${availL}" tab should show "${products.contactSales}"`).toBe(true);
    expect.soft(sameSet(avail.map((c) => c.name), inactiveNames), `"${availL}" tab should list exactly the inactive assessments of the "${allL}" tab`).toBe(true);
    console.log(`"${availL}" tab (${avail.length}):\n${avail.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}`);

    // 3. "All" tab: "Contact Sales" only on inactive assessments, and only if there are any
    const back = await openTab(allL);
    expect.soft(back.length, `"${allL}" tab should list ${active.length} + ${avail.length} assessments`).toBe(active.length + avail.length);
    const inactive = back.filter((c) => !c.active);
    if (inactive.length > 0) {
      for (const c of inactive) {
        expect.soft(c.contact, `Inactive assessment "${c.name}" should show "${products.contactSales}"`).toBe(true);
        expect.soft(c.details, `Inactive assessment "${c.name}" should not show "${products.cardAction}"`).toBe(false);
      }
      console.log(`"${allL}" tab: ${inactive.length} inactive assessment(s) show "${products.contactSales}": ${inactive.map((c) => c.name).join(', ')}`);
    } else {
      expect.soft(back.some((c) => c.contact), `No inactive assessment, so no "${products.contactSales}" should be shown`).toBe(false);
      console.log(`"${allL}" tab: no inactive assessment present, so no "${products.contactSales}" is shown`);
    }
    for (const c of back.filter((x) => x.active)) {
      expect.soft(c.contact, `Active assessment "${c.name}" should not show "${products.contactSales}"`).toBe(false);
    }
  } 
    async verifyProductsSearch(products, timeout = 15000) {
    const sc = products.search;
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allLabel = products.tabs[0];
    const cards = E2ELocators.productCards(this.page, products.cardAction);
    const box = E2ELocators.productSearchBox(this.page, sc.boxName);
    const settle = () => this.page.waitForTimeout(sc.settleMs);
    const allCount = Number((await E2ELocators.productTab(this.page, esc(allLabel), products.tabCountPattern).innerText()).match(/\d+/)[0]);
    const expectAllCards = async (what) => {
      await expect(box, `Search box should be empty ${what}`).toHaveValue('', { timeout });
      await expect.poll(() => cards.count(), { message: `All ${allCount} assessments should be listed ${what}`, timeout }).toBe(allCount);
    };
    await expect(box, 'Search box').toBeVisible({ timeout });

    // 1. invalid data -> "No results for ..."
    await box.fill(sc.invalidTerm);
    const noResults = E2ELocators.productNoResults(this.page, sc.noResultsText, sc.invalidTerm);
    await expect(noResults, `"${sc.noResultsText} ${sc.invalidTerm}" message`).toBeVisible({ timeout });
    await expect(this.page.getByText(sc.noResultsHint, { exact: true }), `"${sc.noResultsHint}" hint`).toBeVisible();
    await expect(cards, 'No assessment card should be listed for an invalid search').toHaveCount(0);
    console.log(`Invalid search "${sc.invalidTerm}": "${(await noResults.innerText()).trim()}"`);

    // 2. "Reset filters" -> the search is cleared and all assessments are listed again
    await E2ELocators.productResetFilters(this.page, sc.resetLink).click();
    await expect(noResults, 'No-results message should go away after reset').toBeHidden({ timeout });
    await expectAllCards(`after "${sc.resetLink}"`);
    console.log(`"${sc.resetLink}" cleared the search; ${allCount} assessments listed again`);

    // 3. valid data -> matching assessments
    await box.fill(sc.validTerm);
    await expect.poll(() => cards.count(), { message: `Search "${sc.validTerm}" should narrow the list`, timeout }).toBeLessThan(allCount);
    const found = await cards.count();
    expect(found, `Search "${sc.validTerm}" should show at least one assessment`).toBeGreaterThan(0);
    const names = [];
    for (let i = 0; i < found; i++) {
      const card = cards.nth(i);
      const text = (await card.innerText()).toLowerCase();
      expect.soft(text.includes(sc.validTerm.toLowerCase()), `Result ${i + 1} should match "${sc.validTerm}"`).toBe(true);
      names.push((await E2ELocators.productCardName(card).innerText()).trim());
    }
    console.log(`Valid search "${sc.validTerm}" (${found}): ${names.join(' | ')}`);

    // 4. cross icon in the search bar -> search cleared, all assessments listed
    await settle();
    await E2ELocators.productSearchClear(box, sc.clearIcon).click();
    await expectAllCards('after clicking the cross icon');
    console.log(`Cross icon cleared the search; ${allCount} assessments listed again`);
  }
  // =====================================================
  // Profile
  // =====================================================
  // 1. click the Profile menu
  async clickProfileMenu(profile, timeout = 15000) {
    const menu = E2ELocators.profileMenu(this.page, profile.menuName);
    await expect(menu, `"${profile.menuName}" menu`).toBeVisible({ timeout });
    await menu.click();
  }

  // 2. the Profile page opens and shows its title and the statement
  async verifyProfileScreen(profile, timeout = 15000) {
    await expect(this.page, 'Profile page URL').toHaveURL(new RegExp(profile.urlPattern), { timeout });
    await expect(E2ELocators.profilePageTitle(this.page, profile.pageTitle), `Page title "${profile.pageTitle}"`).toBeVisible({ timeout });
    console.log(`Page title shown: "${profile.pageTitle}"`);
    await expect(E2ELocators.profileSubtitle(this.page, profile.subtitle), `"${profile.subtitle}" statement`).toBeVisible({ timeout });
    console.log(`Statement shown: "${profile.subtitle}"`);
  }
    async verifyProfileTabs(profile, timeout = 15000) {
    const tabs = profile.tabs;
    const tabOf = (name) => E2ELocators.profileTab(this.page, name);

    // These tabs have no aria-selected or "active" class, so the selected tab is the one
    // whose look (text colour / underline / weight) differs from the other tabs.
    const signature = (name) => tabOf(name).evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.borderBottomColor, s.borderBottomWidth, s.fontWeight].join('|');
    });
    const selectedNames = async () => {
      const sigs = {};
      for (const t of tabs) sigs[t.name] = await signature(t.name);
      const tally = {};
      Object.values(sigs).forEach((s) => { tally[s] = (tally[s] || 0) + 1; });
      const common = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      return tabs.filter((t) => sigs[t.name] !== common).map((t) => t.name);
    };

    // the tab "name" is the only selected tab, and only its content is shown
    const expectOnly = async (name, what) => {
      await expect.poll(selectedNames, { message: `Only the "${name}" tab should be selected ${what}`, timeout }).toEqual([name]);
      const current = tabs.find((t) => t.name === name);
      for (const text of current.contents) {
        await expect.soft(E2ELocators.profileText(this.page, text), `"${text}" should be shown on the "${name}" tab`).toBeVisible({ timeout });
      }
      for (const other of tabs.filter((t) => t.name !== name)) {
        await expect.soft(E2ELocators.profileText(this.page, other.heading), `"${other.heading}" (${other.name} tab) should not be shown on the "${name}" tab`).toHaveCount(0);
      }
    };

    // 1. all tabs are displayed
    for (const t of tabs) {
      await expect(tabOf(t.name), `"${t.name}" tab`).toBeVisible({ timeout });
    }
    console.log(`Profile tabs shown: ${tabs.map((t) => t.name).join(' | ')}`);

    // 2. "Information" is the default tab (selected on load)
    await expectOnly(profile.defaultTab, 'on load');
    console.log(`"${profile.defaultTab}" is the default tab`);

    // 3. click each tab -> its own content loads
    for (const t of tabs) {
      await tabOf(t.name).click();
      await expectOnly(t.name, 'after clicking it');
      console.log(`"${t.name}" tab: ${t.contents.join(' | ')}`);
    }
  }
}