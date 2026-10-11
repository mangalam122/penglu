const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePrice, formatPrice } = require('../src/price.js');

test('parses common price formats', () => {
  assert.deepEqual(parsePrice('₹9,995'), { amount: 9995, currency: 'INR' });
  assert.deepEqual(parsePrice('Order total: ₹ 1,23,456.50'), { amount: 123456.5, currency: 'INR' });
  assert.deepEqual(parsePrice('Rs. 499'), { amount: 499, currency: 'INR' });
  assert.deepEqual(parsePrice('Pay INR 2,150'), { amount: 2150, currency: 'INR' });
  assert.deepEqual(parsePrice('$24.99'), { amount: 24.99, currency: 'USD' });
  assert.deepEqual(parsePrice('S$ 120'), { amount: 120, currency: 'SGD' });
  assert.deepEqual(parsePrice('€15'), { amount: 15, currency: 'EUR' });
  assert.deepEqual(parsePrice('1,299 INR'), { amount: 1299, currency: 'INR' });
});

test('returns null when there is no price', () => {
  assert.equal(parsePrice('Free delivery tomorrow'), null);
  assert.equal(parsePrice('2,318 ratings'), null);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('₹0'), null);
});

test('formats prices for display', () => {
  assert.equal(formatPrice({ amount: 123456, currency: 'INR' }), '₹1,23,456');
  assert.equal(formatPrice({ amount: 24.99, currency: 'USD' }), '$24.99');
  assert.equal(formatPrice(null), '');
});
