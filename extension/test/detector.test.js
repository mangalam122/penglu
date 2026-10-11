const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, isCheckoutUrl } = require('../src/detector.js');

const PRODUCT = 'https://shop.example.in/p/aurora-75-keyboard';
const CHECKOUT = 'https://shop.example.in/checkout/payment';

const yes = (text, url = PRODUCT, extra = {}) =>
  assert.equal(classify({ text, url, ...extra }).isPurchase, true, `expected purchase: "${text}" on ${url}`);
const no = (text, url = PRODUCT, extra = {}) =>
  assert.equal(classify({ text, url, ...extra }).isPurchase, false, `expected no purchase: "${text}" on ${url}`);

test('commit buttons are purchases anywhere', () => {
  ['Buy now', 'BUY NOW', 'Buy', 'Buy ₹9,995', 'Place order', 'Place your order',
   'Complete purchase', 'Confirm order', 'Confirm & pay', 'Pay now', 'Proceed to pay',
   'Proceed to payment', 'Make payment', 'Order now', 'Pay ₹9,995', 'Pay Rs. 499',
   'Pay $24.99', 'Submit order', 'Place Order ›'].forEach(t => yes(t));
});

test('browsing and staging buttons are never purchases', () => {
  ['Add to cart', 'Add to Bag', 'Added to basket', 'Add to wishlist', 'Save for later',
   'View cart', 'Go to cart', 'Continue shopping', 'Proceed to checkout', 'Buy it again',
   'Buy again', 'Remove', 'Apply coupon', 'Pay later options', 'Learn more'].forEach(t => no(t));
  ['Add to cart', 'Proceed to checkout'].forEach(t => no(t, CHECKOUT));
});

test('weak labels need a checkout page', () => {
  ['Pay', 'Continue', 'Next', 'Continue to payment', 'Subscribe', 'Upgrade now', 'Checkout'].forEach(t => {
    no(t, PRODUCT);
    yes(t, CHECKOUT);
  });
});

test('reads aria-label, value and title when text is empty', () => {
  yes('', PRODUCT, { ariaLabel: 'Place your order' });
  yes('', PRODUCT, { value: 'Buy Now' });
  yes('', PRODUCT, { title: 'Pay now' });
  no('', PRODUCT, { ariaLabel: 'Add to cart' });
});

test('an exclusion on any label wins over a match on another', () => {
  no('Buy', PRODUCT, { ariaLabel: 'Add to cart' });
});

test('long text is a card or paragraph, not a button', () => {
  no('Buy now and get free delivery on orders over 499 with our premium membership plan');
});

test('ordinary text is not a purchase', () => {
  ['Home', 'Search', 'Sign in', 'Reviews', 'Buying guide', ''].forEach(t => no(t, CHECKOUT));
});

test('checkout URL detection', () => {
  ['https://a.in/checkout', 'https://a.in/checkout/step-3', 'https://a.in/payment?x=1',
   'https://a.in/buy/123', 'https://a.in/order-review', 'https://a.in/place_order']
    .forEach(u => assert.ok(isCheckoutUrl(u), u));
  ['https://a.in/', 'https://a.in/p/payments-book', 'https://a.in/search?q=checkout']
    .forEach(u => assert.ok(!isCheckoutUrl(u), u));
});

test('result explains itself', () => {
  const r = classify({ text: 'Place order', url: PRODUCT });
  assert.equal(r.confidence, 'strong');
  assert.equal(r.label, 'place order');
  assert.match(r.reason, /commit button/);
});
