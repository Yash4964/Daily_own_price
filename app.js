const API_URL = "https://69f894f4f7044aa0103e15a0.mockapi.io/Daily_Price";
const LOGIN_API_URL = "https://69f894f4f7044aa0103e15a0.mockapi.io/login";
const AUTH_STORAGE_KEY = "dailyPriceUser";
const page = document.body.dataset.page;
let records = [];

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const qs = (selector) => document.querySelector(selector);
const categoryColors = {
  Food: "#f59e0b",
  Hardware: "#2563eb",
  Other: "#8b5cf6"
};
const categoryNames = Object.keys(categoryColors);
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const eyeIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
`;
const eyeOffIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3l18 18"></path>
    <path d="M10.7 5.2A10.7 10.7 0 0 1 12 5c6 0 9.5 7 9.5 7a18 18 0 0 1-3.2 4.1"></path>
    <path d="M6.6 6.8A17 17 0 0 0 2.5 12S6 19 12 19a9.8 9.8 0 0 0 3.4-.6"></path>
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
  </svg>
`;
let calendarDate = new Date();
let dashboardPeriod = "day";
let dashboardDate = toDateValue(new Date());

function formatMoney(value) {
  return money.format(Number(value) || 0);
}

function formatWholeMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function normalizeRecord(record) {
  return {
    ...record,
    person: record.person || null,
    description: record.description || "",
    date: record.date || "",
    price: Number(record.price) || 0,
    type: record.type || "expense"
  };
}

function getCategory(description) {
  const value = String(description || "").trim().toLowerCase();
  if (value === "food") return "Food";
  if (value === "hardware" || value === "hardwar") return "Hardware";
  return "Other";
}

function showToast(message) {
  const toast = qs("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

async function request(endpoint = "", options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function authRequest(endpoint = "", options = {}) {
  const response = await fetch(`${LOGIN_API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Login request failed: ${response.status}`);
  }

  return response.json();
}

function getSessionUser() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    return user?.id && user?.username ? user : null;
  } catch (error) {
    return null;
  }
}

function setSessionUser(user) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    id: user.id,
    username: user.username
  }));
}

function clearSessionUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function redirectToLogin() {
  const target = encodeURIComponent(window.location.pathname.split("/").pop() || "index.html");
  window.location.href = `login.html?next=${target}`;
}

function requireLogin() {
  if (page === "login") return true;
  if (getSessionUser()) return true;
  redirectToLogin();
  return false;
}

function getLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  return next && !next.includes("/") && next.endsWith(".html") ? next : "index.html";
}

function injectAccountControls() {
  const topbar = qs(".topbar");
  if (!topbar || page === "login") return;
  const user = getSessionUser();
  if (!user) return;

  const account = document.createElement("div");
  account.className = "account-menu";
  account.innerHTML = `
    <span class="account-chip">
      <span>${escapeHtml(user.username.slice(0, 1).toUpperCase())}</span>
      <strong>${escapeHtml(user.username)}</strong>
    </span>
    <button class="account-action" type="button" id="changePasswordBtn">Change password</button>
    <button class="logout-btn" type="button" id="logoutBtn">Logout</button>
  `;
  topbar.append(account);

  qs("#logoutBtn")?.addEventListener("click", () => {
    clearSessionUser();
    window.location.href = "login.html";
  });
  qs("#changePasswordBtn")?.addEventListener("click", openPasswordDialog);
}

function openPasswordDialog() {
  if (qs("#passwordDialog")) {
    qs("#passwordDialog").classList.add("open");
    qs("#currentPassword")?.focus();
    return;
  }

  const dialog = document.createElement("div");
  dialog.id = "passwordDialog";
  dialog.className = "auth-dialog open";
  dialog.innerHTML = `
    <div class="auth-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="passwordDialogTitle">
      <div class="panel-title">
        <div>
          <p class="eyebrow">Account</p>
          <h2 id="passwordDialogTitle">Change password</h2>
        </div>
        <button class="dialog-close" type="button" id="closePasswordDialog">x</button>
      </div>
      <form id="passwordForm">
        <label>
          Current password
          <span class="password-control">
            <input id="currentPassword" type="password" autocomplete="current-password" required>
            <button class="password-toggle" type="button" data-toggle-password="currentPassword" aria-label="Show password">${eyeIcon}</button>
          </span>
        </label>
        <label>
          New password
          <span class="password-control">
            <input id="newPassword" type="password" autocomplete="new-password" minlength="3" required>
            <button class="password-toggle" type="button" data-toggle-password="newPassword" aria-label="Show password">${eyeIcon}</button>
          </span>
        </label>
        <label>
          Confirm password
          <span class="password-control">
            <input id="confirmPassword" type="password" autocomplete="new-password" minlength="3" required>
            <button class="password-toggle" type="button" data-toggle-password="confirmPassword" aria-label="Show password">${eyeIcon}</button>
          </span>
        </label>
        <button class="primary-action full" type="submit">Update password</button>
      </form>
    </div>
  `;
  document.body.append(dialog);

  qs("#closePasswordDialog")?.addEventListener("click", closePasswordDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePasswordDialog();
  });
  qs("#passwordForm")?.addEventListener("submit", changePassword);
  bindPasswordToggles(dialog);
  qs("#currentPassword")?.focus();
}

function closePasswordDialog() {
  qs("#passwordDialog")?.classList.remove("open");
}

async function changePassword(event) {
  event.preventDefault();
  const user = getSessionUser();
  const currentPassword = qs("#currentPassword").value;
  const newPassword = qs("#newPassword").value;
  const confirmPassword = qs("#confirmPassword").value;

  if (!user) {
    redirectToLogin();
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match");
    return;
  }

  try {
    const account = await authRequest(`/${user.id}`);
    if (account.password !== currentPassword) {
      showToast("Current password is wrong");
      return;
    }
    const updated = await authRequest(`/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...account, password: newPassword })
    });
    setSessionUser(updated);
    closePasswordDialog();
    showToast("Password changed");
  } catch (error) {
    showToast("Password could not change");
  }
}

async function loginUser(event) {
  event.preventDefault();
  const email = qs("#loginEmail").value.trim();
  const password = qs("#loginPassword").value;
  const submitButton = qs("#loginSubmit");

  if (!email || !password) {
    showToast("Enter email and password");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Checking...";

  try {
    const users = await authRequest();
    const user = users.find((item) => item.username === email && item.password === password);
    if (!user) {
      showToast("Invalid username or password");
      return;
    }
    setSessionUser(user);
    window.location.href = getLoginRedirect();
  } catch (error) {
    showToast("Login API could not load");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Login";
  }
}

function bindLoginEvents() {
  if (getSessionUser()) {
    window.location.href = getLoginRedirect();
    return;
  }
  qs("#loginForm")?.addEventListener("submit", loginUser);
  bindPasswordToggles(document);
}

function bindPasswordToggles(scope = document) {
  scope.querySelectorAll("[data-toggle-password]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const input = qs(`#${button.dataset.togglePassword}`);
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.innerHTML = isHidden ? eyeOffIcon : eyeIcon;
      button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });
}

async function loadRecords() {
  try {
    const data = await request();
    records = data.map(normalizeRecord);
  } catch (error) {
    showToast("API data could not load");
    records = [];
  }
}

function getTotals(items = records) {
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.price, 0);
  const expense = items
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.price, 0);

  return {
    income,
    expense,
    balance: income - expense,
    total: income + expense
  };
}

function parseDateValue(value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return null;

  const isoMatch = cleanValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const localMatch = cleanValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (localMatch) {
    return new Date(Number(localMatch[3]), Number(localMatch[2]) - 1, Number(localMatch[1]));
  }

  const parsed = new Date(cleanValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function isSamePeriod(value, period) {
  const itemDate = parseDateValue(value);
  const selectedDate = parseDateValue(dashboardDate);
  if (!itemDate || !selectedDate) return false;

  const current = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const item = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

  if (period === "week") {
    const weekStart = getWeekStart(current);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return item >= weekStart && item <= weekEnd;
  }

  if (period === "month") {
    return item.getFullYear() === current.getFullYear() && item.getMonth() === current.getMonth();
  }

  return item.getTime() === current.getTime();
}

function getDashboardRecords() {
  return records.filter((item) => isSamePeriod(item.date, dashboardPeriod));
}

function getCategoryTotals(items) {
  return categoryNames.map((name) => ({
    name,
    color: categoryColors[name],
    total: items
      .filter((item) => getCategory(item.description) === name)
      .reduce((sum, item) => sum + item.price, 0)
  }));
}

function renderDonutChart({ donutSelector, legendSelector, totalSelector, items, link }) {
  const totals = getCategoryTotals(items);
  const totalAmount = totals.reduce((sum, item) => sum + item.total, 0);
  const activeTotals = totals.filter((item) => item.total > 0);
  let cursor = 0;
  const conicParts = activeTotals.map((item) => {
    const next = cursor + (item.total / (totalAmount || 1)) * 100;
    const part = `${item.color} ${cursor}% ${next}%`;
    cursor = next;
    return part;
  });

  const donut = qs(donutSelector);
  if (donut) {
    donut.style.background = conicParts.length
      ? `conic-gradient(${conicParts.join(", ")})`
      : "conic-gradient(#dfe6f0 0 100%)";
    donut.onclick = () => {
      window.location.href = link;
    };
  }

  const legend = qs(legendSelector);
  if (legend) {
    legend.innerHTML = totals.map((item) => `
      <a href="${link}">
        <span class="dot" style="background:${item.color}"></span>${item.name}
        <strong>${formatMoney(item.total)}</strong>
      </a>
    `).join("");
  }

  setText(totalSelector, formatMoney(totalAmount));
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDate(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function getTrendBuckets() {
  const selectedDate = parseDateValue(dashboardDate) || new Date();

  if (dashboardPeriod === "month") {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const weeks = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let start = 1; start <= daysInMonth; start += 7) {
      const end = Math.min(start + 6, daysInMonth);
      weeks.push({
        label: `${start}-${end}`,
        matches: (date) => date.getFullYear() === year
          && date.getMonth() === month
          && date.getDate() >= start
          && date.getDate() <= end
      });
    }
    return weeks;
  }

  const startDate = dashboardPeriod === "week"
    ? getWeekStart(selectedDate)
    : addDays(selectedDate, -6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      label: dashboardPeriod === "week" ? dayNames[date.getDay()] : `${date.getDate()} ${monthNames[date.getMonth()]}`,
      matches: (itemDate) => isSameDate(itemDate, date)
    };
  });
}

function renderCashflowChart(items) {
  const buckets = getTrendBuckets().map((bucket) => {
    const bucketItems = items.filter((item) => {
      const itemDate = parseDateValue(item.date);
      return itemDate && bucket.matches(itemDate);
    });
    const totals = getTotals(bucketItems);
    return {
      label: bucket.label,
      income: totals.income,
      expense: totals.expense,
      balance: totals.balance
    };
  });

  const width = 760;
  const height = 320;
  const padding = 50;
  const leftPadding = 82;
  const chartHeight = height - padding * 2;
  const chartWidth = width - leftPadding - padding;
  const zeroY = height - padding;
  const bucketWidth = chartWidth / buckets.length;
  const barWidth = Math.min(24, Math.max(10, bucketWidth / 5));
  const maxAmount = Math.max(1, ...buckets.flatMap((item) => [item.income, item.expense]));
  const yForAmount = (amount) => zeroY - (amount / maxAmount) * chartHeight;

  const getBar = (amount, index, offset, className, isExpense = false) => {
    if (!amount) return "";
    const x = leftPadding + index * bucketWidth + bucketWidth / 2 + offset - barWidth / 2;
    const y = yForAmount(amount);
    const barHeight = Math.max(2, zeroY - y);
    const labelY = Math.max(18, y - 10);
    const label = isExpense ? `-${formatWholeMoney(amount)}` : formatWholeMoney(amount);
    return `
      <rect class="${className}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4"></rect>
      <text class="pillar-value" x="${(x + barWidth / 2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${label}</text>
    `;
  };

  const chart = qs("#cashflowChart");
  if (!chart) return;

  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Net cash flow red and green pillar chart">
      <defs>
        <linearGradient id="positivePillarGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#37c878"></stop>
          <stop offset="100%" stop-color="#128b56"></stop>
        </linearGradient>
        <linearGradient id="negativePillarGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#f37a7a"></stop>
          <stop offset="100%" stop-color="#d33f3f"></stop>
        </linearGradient>
      </defs>
      <g class="grid-lines">
        <line x1="${leftPadding}" y1="${padding}" x2="${width - padding}" y2="${padding}"></line>
        <line x1="${leftPadding}" y1="${padding + chartHeight / 3}" x2="${width - padding}" y2="${padding + chartHeight / 3}"></line>
        <line x1="${leftPadding}" y1="${padding + chartHeight * 0.66}" x2="${width - padding}" y2="${padding + chartHeight * 0.66}"></line>
        <line x1="${leftPadding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      </g>
      <line class="zero-line" x1="${leftPadding}" y1="${zeroY.toFixed(1)}" x2="${width - padding}" y2="${zeroY.toFixed(1)}"></line>
      <g class="y-axis-labels">
        <text x="${leftPadding - 14}" y="${padding + 4}" text-anchor="end">${formatMoney(maxAmount)}</text>
        <text x="${leftPadding - 14}" y="${zeroY + 4}" text-anchor="end">₹0</text>
      </g>
      <g class="bar-series">
        ${buckets.map((item, index) => [
          getBar(item.income, index, -barWidth / 2 - 3, "positive-pillar"),
          getBar(item.expense, index, barWidth / 2 + 3, "negative-pillar", true)
        ].join("")).join("")}
      </g>
      <g class="axis-labels">
        ${buckets.map((item, index) => {
          const x = leftPadding + index * bucketWidth + bucketWidth / 2;
          return `<text x="${x}" y="${height - 14}" text-anchor="middle">${escapeHtml(item.label)}</text>`;
        }).join("")}
      </g>
    </svg>
  `;
}

function setText(selector, value) {
  const element = qs(selector);
  if (element) element.textContent = value;
}

function renderDashboard() {
  const filteredRecords = getDashboardRecords();
  const totals = getTotals(filteredRecords);
  setText("#totalIncome", formatMoney(totals.income));
  setText("#totalExpense", formatMoney(totals.expense));
  setText("#totalBalance", formatMoney(totals.balance));
  setText("#recordCount", filteredRecords.length);
  setText("#trendIncomeTotal", formatMoney(totals.income));
  setText("#trendExpenseTotal", formatMoney(totals.expense));
  setText("#trendBalanceTotal", formatMoney(totals.balance));
  setText("#netTrendTotal", formatMoney(totals.balance));

  renderDonutChart({
    donutSelector: "#incomeDonut",
    legendSelector: "#incomeLegend",
    totalSelector: "#incomeChartTotal",
    items: filteredRecords.filter((item) => item.type === "income"),
    link: "income.html"
  });
  renderDonutChart({
    donutSelector: "#expenseDonut",
    legendSelector: "#expenseLegend",
    totalSelector: "#expenseChartTotal",
    items: filteredRecords.filter((item) => item.type === "expense"),
    link: "expense.html"
  });
  renderCashflowChart(records);

  const recentList = qs("#recentList");
  if (!recentList) return;
  const recent = [...filteredRecords].reverse().slice(0, 6);
  recentList.innerHTML = recent.length
    ? recent.map((item) => `
      <a class="recent-item" href="${item.type}.html">
        <span>
          <strong>${escapeHtml(item.description)}</strong>
          <small>${escapeHtml(item.date || "No date")} · ${escapeHtml(item.person || "No person")} · ${formatMoney(item.price)}</small>
        </span>
        <span class="pill ${item.type}">${item.type}</span>
      </a>
    `).join("")
    : `<div class="empty">No records found.</div>`;
}

function renderRouting() {
  const totals = getTotals();
  setText("#routeIncome", formatMoney(totals.income));
  setText("#routeExpense", formatMoney(totals.expense));

  const incomePercent = totals.total ? Math.round((totals.income / totals.total) * 100) : 0;
  const expensePercent = totals.total ? 100 - incomePercent : 0;
  setText("#incomeBar strong", `${incomePercent}%`);
  setText("#expenseBar strong", `${expensePercent}%`);

  const incomeBar = qs("#incomeBar");
  const expenseBar = qs("#expenseBar");
  if (incomeBar && expenseBar && totals.total) {
    incomeBar.style.flexBasis = `${Math.max(incomePercent, 18)}%`;
    expenseBar.style.flexBasis = `${Math.max(expensePercent, 18)}%`;
    qs(".split-bars").style.display = "flex";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  if (!value) return "Select date";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]} ${monthNames[Number(parts[1]) - 1]} ${parts[0]}`;
}

function setDateValue(value) {
  qs("#date").value = value;
  qs("#dateButton").textContent = formatDateLabel(value);
}

function renderDatePicker() {
  const picker = qs("#datePicker");
  if (!picker) return;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selected = qs("#date")?.value;
  let days = "";

  for (let i = 0; i < firstDay; i += 1) {
    days += `<span class="calendar-day muted"></span>`;
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = toDateValue(new Date(year, month, day));
    days += `<button class="calendar-day ${value === selected ? "selected" : ""}" type="button" data-date="${value}">${day}</button>`;
  }

  picker.innerHTML = `
    <div class="calendar-head">
      <button class="calendar-nav" type="button" data-month="-1">&lt;</button>
      <strong>${monthNames[month]} ${year}</strong>
      <button class="calendar-nav" type="button" data-month="1">&gt;</button>
    </div>
    <div class="calendar-grid">
      ${dayNames.map((name) => `<span class="calendar-day-name">${name}</span>`).join("")}
      ${days}
    </div>
  `;
}

function renderCrud() {
  const type = page;
  const search = (qs("#searchInput")?.value || "").toLowerCase().trim();
  const items = records.filter((item) => {
    const matchesType = item.type === type;
    const matchesSearch = !search || [item.description, item.date, item.person, item.price]
      .join(" ")
      .toLowerCase()
      .includes(search);
    return matchesType && matchesSearch;
  });

  const total = items.reduce((sum, item) => sum + item.price, 0);
  setText("#moduleTotal", formatMoney(total));

  const table = qs("#entryTable");
  if (!table) return;
  table.innerHTML = items.length
    ? items.map((item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.date || "-")}</td>
        <td>${escapeHtml(item.person || "Null")}</td>
        <td class="price-cell">${formatMoney(item.price)}</td>
        <td>
          <div class="actions">
            <button class="icon-btn edit" type="button" title="Edit" data-edit="${item.id}">Edit</button>
            <button class="icon-btn delete" type="button" title="Delete" data-delete="${item.id}">Del</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="empty">No ${type} records found.</td></tr>`;
}

function getDescriptionValue() {
  const selected = qs("#descriptionSelect").value;
  if (selected === "Other") return qs("#descriptionOther").value.trim();
  return selected;
}

function setDescriptionValue(description) {
  const category = getCategory(description);
  const descriptionInput = qs("#descriptionSelect");
  descriptionInput.value = category;
  qs("#descriptionOther").value = category === "Other" ? description : "";
  updateCustomSelectLabel(category);
  toggleOtherDescription();
}

function toggleOtherDescription() {
  const otherInput = qs("#descriptionOther");
  const isOther = qs("#descriptionSelect").value === "Other";
  otherInput.classList.toggle("visible", isOther);
  otherInput.required = isOther;
  if (!isOther) otherInput.value = "";
}

function updateCustomSelectLabel(value) {
  const label = qs(".custom-select-btn span");
  if (label) label.textContent = value || "Select category";
  document.querySelectorAll(".custom-select-menu button").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function setDescriptionCategory(value) {
  qs("#descriptionSelect").value = value;
  updateCustomSelectLabel(value);
  toggleOtherDescription();
  if (value === "Other") qs("#descriptionOther").focus();
}

function resetForm() {
  qs("#entryId").value = "";
  qs("#descriptionSelect").value = "Food";
  qs("#descriptionOther").value = "";
  updateCustomSelectLabel("Food");
  toggleOtherDescription();
  setDateValue(toDateValue(new Date()));
  qs("#person").value = "";
  qs("#price").value = "";
  setText("#formTitle", `Add ${page}`);
}

function fillForm(id) {
  const item = records.find((record) => record.id === id);
  if (!item) return;
  qs("#entryId").value = item.id;
  setDescriptionValue(item.description);
  setDateValue(item.date || "");
  qs("#person").value = item.person || "";
  qs("#price").value = item.price;
  setText("#formTitle", `Edit ${page}`);
  qs(".custom-select-btn").focus();
}

async function saveEntry(event) {
  event.preventDefault();
  const id = qs("#entryId").value;
  const payload = {
    person: qs("#person").value.trim() || null,
    description: getDescriptionValue(),
    date: qs("#date").value,
    price: Number(qs("#price").value),
    type: page
  };

  if (!payload.description || !payload.date || payload.price < 0 || Number.isNaN(payload.price)) {
    showToast("Please enter valid details");
    return;
  }

  try {
    if (id) {
      await request(`/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast(`${page} updated`);
    } else {
      await request("", { method: "POST", body: JSON.stringify(payload) });
      showToast(`${page} added`);
    }
    window.location.href = "index.html";
  } catch (error) {
    showToast("Save failed");
  }
}

async function deleteEntry(id) {
  const item = records.find((record) => record.id === id);
  if (!item) return;

  const confirmed = window.confirm(`Delete "${item.description}"?`);
  if (!confirmed) return;

  try {
    await request(`/${id}`, { method: "DELETE" });
    showToast(`${page} deleted`);
    await loadRecords();
    renderCrud();
  } catch (error) {
    showToast("Delete failed");
  }
}

function bindCrudEvents() {
  qs("#entryForm")?.addEventListener("submit", saveEntry);
  qs("#resetBtn")?.addEventListener("click", resetForm);
  qs(".custom-select-btn")?.addEventListener("click", () => {
    qs(".custom-select").classList.toggle("open");
  });
  qs(".custom-select-menu")?.addEventListener("click", (event) => {
    const option = event.target.closest("button[data-value]");
    if (!option) return;
    setDescriptionCategory(option.dataset.value);
    qs(".custom-select").classList.remove("open");
  });
  qs("#dateButton")?.addEventListener("click", () => {
    qs(".date-control").classList.toggle("open");
    renderDatePicker();
  });
  qs("#datePicker")?.addEventListener("click", (event) => {
    const monthButton = event.target.closest("button[data-month]");
    const dayButton = event.target.closest("button[data-date]");
    if (monthButton) {
      calendarDate.setMonth(calendarDate.getMonth() + Number(monthButton.dataset.month));
      renderDatePicker();
    }
    if (dayButton) {
      setDateValue(dayButton.dataset.date);
      qs(".date-control").classList.remove("open");
      renderDatePicker();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".custom-select")) qs(".custom-select")?.classList.remove("open");
    if (!event.target.closest(".date-control")) qs(".date-control")?.classList.remove("open");
  });
  qs("#searchInput")?.addEventListener("input", renderCrud);
  qs("#entryTable")?.addEventListener("click", (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) fillForm(editId);
    if (deleteId) deleteEntry(deleteId);
  });
}

function bindDashboardEvents() {
  const dateInput = qs("#dashboardDate");
  if (dateInput) {
    dateInput.value = dashboardDate;
    dateInput.addEventListener("change", () => {
      dashboardDate = dateInput.value || toDateValue(new Date());
      renderDashboard();
    });
  }

  document.querySelectorAll(".period-btn").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardPeriod = button.dataset.period || "day";
      document.querySelectorAll(".period-btn").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      renderDashboard();
    });
  });
}

async function init() {
  if (page === "login") {
    bindLoginEvents();
    return;
  }

  if (!requireLogin()) return;
  injectAccountControls();
  await loadRecords();

  if (page === "dashboard") {
    bindDashboardEvents();
    renderDashboard();
  }
  if (page === "routing") renderRouting();
  if (page === "income" || page === "expense") {
    bindCrudEvents();
    resetForm();
    renderCrud();
  }
}

init();
