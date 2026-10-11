const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { isProductPage, readProduct, stripTracking } = require('../src/product.js');

const load = (name, url) => new JSDOM(fs.readFileSync(path.join(__dirname, 'fixtures', name + '.html'), 'utf8'), { url }).window.document;

test('recognises product pages', () => {
  assert.ok(isProductPage(load('myntra-product', 'https://www.myntra.com/keyboards/aurora/123/buy'), 'https://www.myntra.com/keyboards/aurora/123/buy'));
  assert.ok(isProductPage(load('amazon-product', 'https://www.amazon.in/dp/B0TEST'), 'https://www.amazon.in/dp/B0TEST'));
  assert.ok(isProductPage(load('flipkart-product', 'https://www.flipkart.com/aurora-75/p/itm123'), 'https://www.flipkart.com/aurora-75/p/itm123'));
});

test('a checkout page is not a product page', () => {
  assert.ok(!isProductPage(load('checkout', 'https://shop.example.in/checkout'), 'https://shop.example.in/checkout'));
});

test('reads name, price and a clean link', () => {
  const url = 'https://www.amazon.in/dp/B0TEST?tag=abc-21&ref=sr_1_1&th=1';
  const p = readProduct(load('amazon-product', url), url);
  assert.equal(p.name, 'Aurora 75 Mechanical Keyboard, Hot-swap, RGB, Wireless');
  assert.equal(p.price.amount, 9995);
  assert.equal(p.url, 'https://www.amazon.in/dp/B0TEST');
});

test('prefers JSON-LD product name', () => {
  const url = 'https://www.myntra.com/keyboards/aurora/123/buy';
  assert.equal(readProduct(load('myntra-product', url), url).name, 'Aurora 75 Mechanical Keyboard');
});

test('strips tracking but keeps real parameters', () => {
  assert.equal(stripTracking('https://a.in/p/x?pid=KBD123&utm_source=ig&otracker=search#reviews'), 'https://a.in/p/x?pid=KBD123');
});
