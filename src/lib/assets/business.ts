import { ISO_SHOP_ANCHORS, ISO_SHELF_ANCHORS, ISO_CHECKOUT_ANCHORS, ISO_POS_ANCHORS, ISO_PRODUCT_ANCHORS } from '@/motion-kit/isometric/IsoShop';
import type { AssetEntry, AssetPropSpec } from './types';

const base = {
  version: '0.1.0', status: 'experimental', projection: 'isometric-30', styles: ['world'],
  bounds: { viewBox: [760, 480], groundOrigin: [380, 300] }, protectedMaterials: [],
  provenance: { author: 'gmotion', license: 'proprietary', commercialUse: true },
} as const;
const color = (value: string, material: string, description: string): AssetPropSpec => ({ type: 'color', default: value, material, description });
const progress = (description: string): AssetPropSpec => ({ type: 'number', min: 0, max: 1, default: 0, animatable: true, description });
const productColor = color('#CB8154', 'material.product', 'Generic package color, without brand or price');

export const BUSINESS_ASSETS: readonly AssetEntry[] = [
  {
    ...base, assetId: 'business.shop', label: 'Toko generik', renderer: 'IsoShop',
    aliases: ['toko', 'warung', 'shop', 'store', 'minimarket'], defaultVariant: 'generic',
    variants: { generic: { label: 'Toko dengan rak dan kasir', aliases: [], capabilities: ['storefront', 'swing-door', 'interior-cutaway', 'shelf', 'checkout', 'product-transfer', 'pos-screen'], anchors: ISO_SHOP_ANCHORS, limitations: ['Fixed interior arrangement; no people, restocking, or customer transactions'] } },
    props: {
      view: { type: 'enum', values: ['exterior', 'cutaway'], default: 'exterior', description: 'Storefront or roof/front removed to expose the interior' },
      doorOpen: progress('Hinged door, closed 0 to open 90 degrees 1; only visible in exterior view'),
      wallColor: color('#D7D2BE', 'material.wall', 'Shop walls'),
      awningColor: color('#537E79', 'material.awning', 'Awning stripes and blank sign panel'),
      shelfColor: color('#8A9B98', 'material.shelf', 'Interior shelf frame'), productColor,
      scanProgress: progress('Illustrative package travel across the checkout; only visible in cutaway'),
      posActive: { type: 'boolean', default: false, description: 'Light the interior POS screen without totals or a payment-success claim' },
    },
    limitations: ['Single isometric view, no 2D asset or orbit', 'No text, logo, price, sales data, or payment processing', 'Door motion in exterior and package motion in cutaway; hidden parts must not be narrated as visible'],
  },
  {
    ...base, assetId: 'business.shelf', label: 'Rak produk', renderer: 'IsoShelf', aliases: ['rak', 'rak produk', 'shelf', 'shelves'], defaultVariant: 'three-tier',
    variants: { 'three-tier': { label: 'Rak tiga tingkat', aliases: [], capabilities: ['three-tier-shelf', 'generic-packages', 'stock-count-0-6', 'shelf-highlight'], anchors: ISO_SHELF_ANCHORS, limitations: ['Six display slots, illustrative rather than an inventory feed; no pickup or restocking'] } },
    props: {
      stockCount: { type: 'number', min: 0, max: 6, integer: true, default: 6, description: 'Number of illustrative packages in fixed display slots' },
      color: color('#8A9B98', 'material.shelf', 'Shelf frame'), productColor,
      highlight: progress('Highlight the front edges of shelves'),
    }, limitations: ['No brand, price tags, revenue, or automatic inventory updates', 'Single isometric view'],
  },
  {
    ...base, assetId: 'business.checkout', label: 'Meja kasir', renderer: 'IsoCheckout', aliases: ['kasir', 'meja kasir', 'checkout', 'checkout counter'], defaultVariant: 'counter',
    variants: { counter: { label: 'Meja kasir dengan POS', aliases: [], capabilities: ['checkout-counter', 'generic-package-transfer', 'scanner-light', 'cash-drawer', 'pos-screen'], anchors: ISO_CHECKOUT_ANCHORS, limitations: ['Product transfer and scanner light are illustrative; no actual barcode lookup, receipt, or payment'] } },
    props: {
      color: color('#AE8D6C', 'material.counter', 'Counter cabinet'), productColor,
      scanProgress: progress('Move package from input through scanner to output; no automatic looping'),
      drawerOpen: progress('Cash drawer slide; no currency is drawn'),
      active: { type: 'boolean', default: false, description: 'Scanner line and POS display on; not a successful transaction' },
    }, limitations: ['No people, hand grip, pricing, tax, cash balance, or brand', 'Single isometric view'],
  },
  {
    ...base, assetId: 'business.product', label: 'Produk kemasan generik', renderer: 'IsoProduct', aliases: ['produk', 'kemasan', 'product', 'packaged goods'], defaultVariant: 'box',
    variants: Object.fromEntries((['box', 'bottle', 'can'] as const).map((variant) => [variant, {
      label: { box: 'Kotak', bottle: 'Botol', can: 'Kaleng' }[variant],
      aliases: { box: ['kotak', 'box'], bottle: ['botol', 'bottle'], can: ['kaleng', 'tin can', 'canned product'] }[variant],
      capabilities: ['generic-package', 'vertical-lift'], anchors: ISO_PRODUCT_ANCHORS[variant],
      limitations: ['Blank packaging, no contents, brand, size, price, or nutrition claims'],
    }])),
    props: {
      color: productColor,
      lift: { type: 'number', min: 0, max: 80, default: 0, animatable: true, description: 'Illustrative vertical lift in world units; no hand interaction' },
    }, limitations: ['Single isometric view, no opening or physical simulation', 'No label text or price; supply those through scene content'],
  },
  {
    ...base, assetId: 'business.pos', label: 'Terminal POS', renderer: 'IsoPosTerminal', aliases: ['pos', 'terminal kasir', 'point of sale'], defaultVariant: 'desktop',
    variants: { desktop: { label: 'POS meja', aliases: [], capabilities: ['desktop-pos', 'screen-on-off', 'generic-keypad'], anchors: ISO_POS_ANCHORS, limitations: ['Abstract screen rows only; no amounts, QR code, or payment status'] } },
    props: { color: color('#425C62', 'material.pos', 'POS housing'), active: { type: 'boolean', default: false, description: 'Screen on/off; does not mean payment succeeded' } },
    limitations: ['No payment integration, receipt printer, or brand', 'Single isometric view'],
  },
];
