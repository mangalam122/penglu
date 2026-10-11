const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { findPrice } = require('../src/pricefinder.js');

function load(name) {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', name + '.html'), 'utf8');
  return new JSDOM(html).window.document;
}
const amount = r => r.price && r.price.amount;

test('Myntra-style product page: ignores nav promos, reads product data', () => {
  const doc = load('myntra-product');
  const r = findPrice(doc, {});
  assert.equal(amount(r), 9995);
  assert.equal(r.source, 'product data');
});

test('Flipkart-style product page: ignores bank offer, reads price next to Buy Now', () => {
  const doc = load('flipkart-product');
  const btn = doc.querySelector('button');
  const r = findPrice(doc, { clicked: btn, label: 'buy now' });
  assert.equal(amount(r), 9995);
  assert.equal(r.source, 'next to button');
});

test('Flipkart-style cart: Total Amount row wins over MRP', () => {
  const doc = load('flipkart-cart');
  const r = findPrice(doc, { clicked: doc.querySelector('button'), label: 'place order' });
  assert.equal(amount(r), 9995);
  assert.equal(r.source, 'order total');
});

test('Checkout summary: Order Total beats subtotal, item lines and header promos', () => {
  const doc = load('checkout');
  const r = findPrice(doc, { clicked: doc.querySelector('#place'), label: 'place order' });
  assert.equal(amount(r), 10834);
});

test('Amazon-style product page: skips M.R.P. and "Total ratings", uses buy box price', () => {
  const doc = load('amazon-product');
  const r = findPrice(doc, { clicked: doc.querySelector('#buy-now-button'), label: 'buy now' });
  assert.equal(amount(r), 9995);
});

test('price written on the button beats everything', () => {
  const doc = load('checkout');
  const r = findPrice(doc, { label: 'pay ₹10,834' });
  assert.equal(amount(r), 10834);
  assert.equal(r.source, 'button');
});

test('no reliable price returns null instead of a guess', () => {
  const doc = new JSDOM('<body><nav>Deals under ₹99</nav><p>Sale ends soon! Save up to ₹2,000</p><button>Buy now</button></body>').window.document;
  const r = findPrice(doc, { label: 'buy now' });
  assert.equal(r.price, null);
});
