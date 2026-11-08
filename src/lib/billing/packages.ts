export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceIdr: number;
}

// PLACEHOLDER prices. Replace with final numbers before accepting real payments.
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'coba', name: 'Coba', credits: 5, priceIdr: 50_000 },
  { id: 'kreator', name: 'Kreator', credits: 20, priceIdr: 180_000 },
  { id: 'studio', name: 'Studio', credits: 50, priceIdr: 400_000 },
];

export const findCreditPackage = (id: string) => CREDIT_PACKAGES.find((item) => item.id === id);

export const formatRupiah = (amount: number) => `Rp${amount.toLocaleString('id-ID')}`;
