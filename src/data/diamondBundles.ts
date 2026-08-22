export interface DiamondBundle {
  id: string;
  diamonds: number;
  price: string;       // display string — replaced by store price once IAP is live
  priceUSD: number;    // numeric, used for sorting / analytics
  badge?: string;      // e.g. "Most Popular", "Best Value"
  bonusPct?: number;   // bonus % vs the base $0.99 rate
}

export const DIAMOND_BUNDLES: DiamondBundle[] = [
  { id: 'gem_50',   diamonds:   50, price: '$0.99',  priceUSD: 0.99  },
  { id: 'gem_100',  diamonds:  100, price: '$1.99',  priceUSD: 1.99  },
  { id: 'gem_250',  diamonds:  250, price: '$3.99',  priceUSD: 3.99,  badge: 'Most Popular' },
  { id: 'gem_600',  diamonds:  600, price: '$7.99',  priceUSD: 7.99,  bonusPct: 20 },
  { id: 'gem_1300', diamonds: 1300, price: '$14.99', priceUSD: 14.99, bonusPct: 30, badge: 'Best Value' },
];
