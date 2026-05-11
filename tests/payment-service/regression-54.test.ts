import { calculateTotal } from '../src/payment-service/src/helpers';

describe('Payment Service Helpers', () => {
  it('should correctly calculate total amount with discount', () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 }
    ];
    const discount = 0.1;
    const expectedTotal = (items[0].price * items[0].quantity + items[1].price * items[1].quantity) * (1 - discount);

    expect(calculateTotal(items, discount)).toBe(expectedTotal);
  });

  it('should correctly calculate total amount without discount', () => {
    const items = [
      { price: 150, quantity: 1 },
      { price: 75, quantity: 3 }
    ];
    const discount = 0;
    const expectedTotal = items[0].price * items[0].quantity + items[1].price * items[1].quantity;

    expect(calculateTotal(items, discount)).toBe(expectedTotal);
  });

  it('should handle empty items array', () => {
    const items: { price: number; quantity: number }[] = [];
    const discount = 0.2;
    const expectedTotal = 0;

    expect(calculateTotal(items, discount)).toBe(expectedTotal);
  });
});