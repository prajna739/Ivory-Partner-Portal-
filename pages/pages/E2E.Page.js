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
  
}