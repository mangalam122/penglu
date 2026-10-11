// Penglu price parsing. Pure logic: turns "₹9,995.00" or "Rs. 1,299" into
// { amount: 9995, currency: 'INR' }. Shared by the content script and tests.
(function (root) {
  'use strict';

  const CURRENCIES = [
    { re: /(₹|rs\.?|inr)/i, code: 'INR' },
    { re: /(\$|usd)/i, code: 'USD' },
    { re: /(€|eur)/i, code: 'EUR' },
    { re: /(£|gbp)/i, code: 'GBP' },
    { re: /(s\$|sgd)/i, code: 'SGD' }
  ];

  // A currency marker followed by a number, or a number followed by a code.
  const PRICE = /(₹|rs\.?|inr|s\$|sgd|\$|usd|€|eur|£|gbp)\s*([\d][\d,]*(?:\.\d{1,2})?)|([\d][\d,]*(?:\.\d{1,2})?)\s*(inr|usd|eur|gbp|sgd)\b/i;

  function currencyOf(marker) {
    const m = String(marker || '');
    if (/s\$|sgd/i.test(m)) return 'SGD';
    const hit = CURRENCIES.find(c => c.re.test(m));
    return hit ? hit.code : null;
  }

  // Returns the first price in the text, or null.
  function parsePrice(text) {
    const m = PRICE.exec(String(text || ''));
    if (!m) return null;
    const marker = m[1] || m[4];
    const digits = (m[2] || m[3]).replace(/,/g, '');
    const amount = Number(digits);
    if (!isFinite(amount) || amount <= 0) return null;
    return { amount, currency: currencyOf(marker) };
  }

  function formatPrice(p) {
    if (!p) return '';
    const symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£', SGD: 'S$' }[p.currency] || '';
    const locale = p.currency === 'INR' ? 'en-IN' : 'en-US';
    const digits = Number.isInteger(p.amount) ? 0 : 2;
    return symbol + p.amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  }

  const api = { parsePrice, formatPrice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.Penglu = root.Penglu || {}).price = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
