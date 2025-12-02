import { defineStore } from 'pinia';
import type { Money } from '@/types';

type CartLine = {
  productId: string;
  title: string;
  quantity: number;
  price: Money;
};

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
};

const defaultState = (): CartState => ({
  lines: [],
  isOpen: false,
});

export const useCartStore = defineStore('cart', {
  state: defaultState,
  getters: {
    itemCount: (state) => state.lines.reduce((total, line) => total + line.quantity, 0),
    totalAmount: (state) =>
      state.lines.reduce((total, line) => total + line.price.amount * line.quantity, 0),
    currency: (state) => state.lines[0]?.price.currency ?? 'RUB',
    hasItems: (state) => state.lines.length > 0,
  },
  actions: {
    reset() {
      Object.assign(this, defaultState());
    },
    toggleCart(isOpen?: boolean) {
      this.isOpen = typeof isOpen === 'boolean' ? isOpen : !this.isOpen;
    },
    addItem(line: CartLine) {
      const existingLine = this.lines.find((current) => current.productId === line.productId);
      if (existingLine) {
        existingLine.quantity += line.quantity;
        existingLine.price = line.price;
        existingLine.title = line.title;
        return;
      }

      this.lines.push({ ...line });
    },
    updateQuantity(productId: string, quantity: number) {
      const line = this.lines.find((current) => current.productId === productId);
      if (!line) return;

      line.quantity = Math.max(1, quantity);
    },
    removeItem(productId: string) {
      this.lines = this.lines.filter((line) => line.productId !== productId);
    },
    clear() {
      this.lines = [];
    },
  },
});
